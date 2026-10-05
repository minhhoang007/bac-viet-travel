import { and, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { users } from "@/core/users/schema";
import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import { checkVnpayOrder, createVnpayIpn, VNPAY_CONFIRMED, type VnpayIpnHandler, type VnpayIpnResult } from "@/core/payments/vnpay-ipn";
import type { RateLimiter } from "@/core/security/rate-limit";
import type { Db } from "@/db/client";
import type { BillingInterval, BillingProviderId, PlanDefinition, PlanId } from "@/config/billing.defaults";
import type { EntitlementsModule } from "@/modules/entitlements";
import type { JobsModule } from "@/modules/jobs";
import type { OneTimePaymentProvider, ProviderSubscription, SubscriptionProvider } from "./ports";
import { billingOrders, subscriptions, webhookEvents } from "./schema";

export const PROCESS_WEBHOOK_JOB = "billing.process_webhook";
const MAX_EVENT_ATTEMPTS = 8;
const EVENT_LEASE = "2 minutes";
const STALE_ORDER_MS = 24 * 60 * 60_000;
const PAYMENT_LINK_MS = 15 * 60_000;

export interface BillingDeps {
  db: Db;
  logger: Logger;
  jobs: JobsModule;
  entitlements: EntitlementsModule;
  plans: Record<PlanId, PlanDefinition>;
  periodDays: Record<BillingInterval, number>;
  providers: BillingProviderId[];
  /** Subscriptions (Polar) — present when "polar" is enabled. */
  polar?: SubscriptionProvider & { products: Partial<Record<PlanId, Partial<Record<BillingInterval, string>>>> };
  /** One-time payments (VNPay) — present when "vnpay" is enabled. */
  vnpay?: OneTimePaymentProvider;
  /** Per-user limit on checkout / portal / payment creation (each call hits the provider or writes an order). */
  checkoutLimiter?: RateLimiter;
  now?: () => Date;
}

export type { VnpayIpnResult } from "@/core/payments/vnpay-ipn";

export interface BillingModule {
  providers: BillingProviderId[];
  createPolarCheckout(user: { id: string; email: string }, plan: PlanId, interval: BillingInterval, successUrl: string): Promise<string>;
  createPolarPortal(userId: string, returnUrl: string): Promise<string>;
  /** Fast path of the webhook endpoint: verify, store, enqueue. Never processes business logic inline. */
  receivePolarWebhook(body: string, headers: Headers): Promise<{ eventRowId: string; duplicate: boolean }>;
  /** Job handler: process one stored event through the state machine. */
  processWebhookEvent(eventRowId: string): Promise<void>;
  /** Periodic: re-queue events stuck in received / processing (expired lease) / failed. */
  sweepWebhookEvents(): Promise<number>;
  /** Periodic: compare live subscriptions with the provider and fix drift. */
  reconcileSubscriptions(limit?: number): Promise<number>;
  createVnpayPayment(input: { user: { id: string }; plan: PlanId; interval: BillingInterval; ipAddr: string; returnUrl: string; locale: "vi" | "en" }): Promise<string>;
  /** Verifies the signature, then handles the IPN. The app endpoint uses `vnpayIpnHandler` behind a shared verifier. */
  handleVnpayIpn(params: Record<string, string>): Promise<VnpayIpnResult>;
  /** IPN for billing orders, signature already verified; null when the txnRef is not a billing order. */
  vnpayIpnHandler: VnpayIpnHandler;
  /** Periodic: delete VNPay orders still pending after a day (the payment link expires after 15 minutes). */
  purgeStaleOrders(): Promise<number>;
  /** Periodic: ask VNPay about orders pending past the 15-minute link (IPN lost) and confirm the paid ones. */
  reconcileVnpayOrders(limit?: number): Promise<number>;
  /** Return-URL page: verified order status (never grants access — only the IPN does). */
  vnpayReturnStatus(params: Record<string, string>): Promise<{ valid: boolean; status: "pending" | "paid" | "failed" | "unknown" }>;
  /** Account deletion hook: revoke live subscriptions at the provider so the user is never charged again. */
  revokeSubscriptionsForUser(userId: string): Promise<number>;
  /** Account export: the user's orders and subscriptions (no provider payloads). */
  exportForUser(userId: string): Promise<{ orders: unknown[]; subscriptions: unknown[] }>;
  /** Admin: recent subscriptions and orders, and webhook events that need attention (no provider payloads). */
  adminOverview(limit?: number): Promise<BillingAdminOverview>;
  /** Admin: give a dead or failed webhook event a fresh attempt budget and queue it. False if not retryable. */
  retryWebhookEvent(eventRowId: string): Promise<boolean>;
}

export interface BillingAdminOverview {
  subscriptions: { id: string; ownerEmail: string | null; plan: string; status: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }[];
  orders: { id: string; ownerEmail: string | null; plan: string; interval: string; amount: number; currency: string; status: string; createdAt: Date }[];
  problemEvents: { id: string; provider: string; type: string; status: string; attempts: number; lastError: string | null; receivedAt: Date }[];
}

// Polar statuses that currently entitle the user (paid through current_period_end).
const ENTITLED = new Set(["active", "trialing", "past_due"]);

export function createBillingModule(deps: BillingDeps): BillingModule {
  const now = deps.now ?? (() => new Date());
  const { db, logger } = deps;

  const requirePolar = () => {
    if (!deps.polar) throw new AppError("BILLING_ERROR", "Polar is not enabled");
    return deps.polar;
  };
  const requireVnpay = () => {
    if (!deps.vnpay) throw new AppError("BILLING_ERROR", "VNPay is not enabled");
    return deps.vnpay;
  };

  const checkLimit = async (userId: string) => {
    if (deps.checkoutLimiter && !(await deps.checkoutLimiter.limit(`billing:checkout:${userId}`)).success) {
      throw new AppError("RATE_LIMIT_ERROR");
    }
  };

  const vnpayIpnHandler: VnpayIpnHandler = async (params) => {
    const [order] = await db
      .select()
      .from(billingOrders)
      .where(and(eq(billingOrders.provider, "vnpay"), eq(billingOrders.txnRef, params.vnp_TxnRef ?? "")));
    if (!order) return null;
    const checked = checkVnpayOrder(order, params);
    if ("stop" in checked) return checked.stop;

    const { success } = checked;
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(billingOrders)
        .set({
          status: success ? "paid" : "failed",
          paidAt: success ? now() : null,
          providerTransactionId: params.vnp_TransactionNo ?? null,
          providerResponse: params,
        })
        .where(and(eq(billingOrders.id, order.id), eq(billingOrders.status, "pending")))
        .returning();
      if (!claimed || !success || !claimed.ownerId) return;
      await deps.entitlements.grantPeriod(
        { ownerId: claimed.ownerId, plan: claimed.plan as PlanId, source: "vnpay_order", sourceId: claimed.id, days: deps.periodDays[claimed.interval] },
        tx,
      );
    });
    logger.info("billing.vnpay_ipn", { orderId: order.id, success });
    return VNPAY_CONFIRMED;
  };

  const planForProduct = (productId: string): PlanId | undefined => {
    for (const [plan, byInterval] of Object.entries(deps.polar?.products ?? {})) {
      if (Object.values(byInterval ?? {}).includes(productId)) return plan as PlanId;
    }
    return undefined;
  };

  /** Applies a subscription snapshot; ignores snapshots older than the stored one. */
  async function applySubscription(sub: ProviderSubscription): Promise<"applied" | "stale" | "ignored"> {
    const plan = planForProduct(sub.productId);
    if (!plan || !sub.externalCustomerId) {
      logger.warn("billing.subscription_ignored", { subscriptionId: sub.id, reason: plan ? "no external customer" : "unknown product" });
      return "ignored";
    }
    const ownerId = sub.externalCustomerId;
    const updatedAt = new Date(sub.updatedAt);
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

    return db.transaction(async (tx) => {
      const written = await tx
        .insert(subscriptions)
        .values({
          ownerId,
          provider: "polar",
          providerSubscriptionId: sub.id,
          plan,
          status: sub.status,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          providerUpdatedAt: updatedAt,
        })
        .onConflictDoUpdate({
          target: [subscriptions.provider, subscriptions.providerSubscriptionId],
          set: {
            plan,
            status: sub.status,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            providerUpdatedAt: updatedAt,
            updatedAt: sql`now()`,
          },
          // Out-of-order protection: only newer (or equal) snapshots overwrite.
          setWhere: sql`${subscriptions.providerUpdatedAt} <= excluded.provider_updated_at`,
        })
        .returning({ id: subscriptions.id });
      if (written.length === 0) return "stale";

      const t = now();
      let endsAt: Date;
      if (sub.endedAt) endsAt = new Date(sub.endedAt);
      else if (ENTITLED.has(sub.status) && periodEnd) endsAt = periodEnd;
      else if (sub.status === "canceled" && sub.cancelAtPeriodEnd && periodEnd) endsAt = periodEnd;
      else endsAt = t; // unpaid, paused, incomplete*, revoked: access ends now
      await deps.entitlements.upsertGrant(
        { ownerId, plan, source: "polar_subscription", sourceId: sub.id, startsAt: t < endsAt ? t : endsAt, endsAt },
        tx,
      );
      return "applied";
    });
  }

  return {
    providers: deps.providers,

    async createPolarCheckout(user, plan, interval, successUrl) {
      const polar = requirePolar();
      await checkLimit(user.id);
      const productId = polar.products[plan]?.[interval];
      if (!productId) throw new AppError("BILLING_ERROR", `No Polar product for ${plan}/${interval}`);
      return (await polar.createCheckout({ productId, userId: user.id, email: user.email, successUrl })).url;
    },

    async createPolarPortal(userId, returnUrl) {
      await checkLimit(userId);
      return (await requirePolar().createPortalSession({ userId, returnUrl })).url;
    },

    async receivePolarWebhook(body, headers) {
      const event = await requirePolar().verifyWebhook(body, headers);
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(webhookEvents)
          .values({
            provider: "polar",
            eventId: event.id,
            type: event.type,
            // Normalized snapshot for processing + raw payload for audit/debugging.
            payload: { subscription: event.subscription ?? null, raw: event.payload },
            providerCreatedAt: event.timestamp ? new Date(event.timestamp) : null,
          })
          .onConflictDoNothing()
          .returning({ id: webhookEvents.id });
        const [row] = inserted.length
          ? inserted
          : await tx
              .select({ id: webhookEvents.id, status: webhookEvents.status })
              .from(webhookEvents)
              .where(and(eq(webhookEvents.provider, "polar"), eq(webhookEvents.eventId, event.id)));
        const duplicate = inserted.length === 0;
        const status = (row as { status?: string }).status;
        // New event, or a duplicate delivery of one not yet processed: make sure a job exists (outbox, same tx).
        if (!duplicate || (status !== "processed" && status !== "dead")) {
          await deps.jobs.enqueue(PROCESS_WEBHOOK_JOB, { eventRowId: row!.id }, { dedupeKey: `webhook:${row!.id}`, maxAttempts: MAX_EVENT_ATTEMPTS, tx });
        }
        return { eventRowId: row!.id, duplicate };
      });
    },

    async processWebhookEvent(eventRowId) {
      // Claim: received/failed, or processing with an expired lease (crashed worker).
      const [event] = await db
        .update(webhookEvents)
        .set({ status: "processing", attempts: sql`${webhookEvents.attempts} + 1`, lockedUntil: sql`now() + ${EVENT_LEASE}::interval` })
        .where(
          and(
            eq(webhookEvents.id, eventRowId),
            or(
              inArray(webhookEvents.status, ["received", "failed"]),
              and(eq(webhookEvents.status, "processing"), lt(webhookEvents.lockedUntil, sql`now()`)),
            ),
          ),
        )
        .returning();
      if (!event) return; // processed, dead, or being processed by another worker

      try {
        if (event.type.startsWith("subscription.")) {
          // Snapshots older than the stored state are skipped (providerUpdatedAt); the daily reconcile
          // fetches the live state from Polar and repairs any remaining drift.
          const snapshot = (event.payload as { subscription?: ProviderSubscription | null }).subscription;
          if (!snapshot) throw new Error("subscription payload missing");
          const outcome = await applySubscription(snapshot);
          if (outcome === "stale") logger.info("billing.stale_event_skipped", { eventId: event.eventId });
        }
        await db
          .update(webhookEvents)
          .set({ status: "processed", processedAt: sql`now()`, lockedUntil: null, lastError: null })
          .where(eq(webhookEvents.id, event.id));
      } catch (error) {
        const dead = event.attempts >= MAX_EVENT_ATTEMPTS;
        await db
          .update(webhookEvents)
          .set({ status: dead ? "dead" : "failed", lockedUntil: null, lastError: error instanceof Error ? error.message.slice(0, 1000) : "unknown" })
          .where(eq(webhookEvents.id, event.id));
        if (dead) logger.error("billing.webhook_dead", { eventId: event.eventId, type: event.type });
        throw error; // let the job retry with backoff
      }
    },

    async sweepWebhookEvents() {
      const stale = await db
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(
          or(
            and(eq(webhookEvents.status, "received"), lt(webhookEvents.receivedAt, sql`now() - interval '5 minutes'`)),
            and(eq(webhookEvents.status, "processing"), lt(webhookEvents.lockedUntil, sql`now()`)),
            and(eq(webhookEvents.status, "failed"), lt(webhookEvents.attempts, MAX_EVENT_ATTEMPTS)),
          ),
        )
        .limit(200);
      for (const { id } of stale) {
        await deps.jobs.enqueue(PROCESS_WEBHOOK_JOB, { eventRowId: id }, { dedupeKey: `webhook:${id}`, maxAttempts: MAX_EVENT_ATTEMPTS });
      }
      if (stale.length) logger.warn("billing.webhooks_requeued", { count: stale.length });
      return stale.length;
    },

    async reconcileSubscriptions(limit = 100) {
      if (!deps.polar) return 0;
      const live = await db
        .select({ id: subscriptions.providerSubscriptionId })
        .from(subscriptions)
        .where(and(eq(subscriptions.provider, "polar"), or(inArray(subscriptions.status, [...ENTITLED]), gt(subscriptions.currentPeriodEnd, now()))))
        .limit(limit);
      let fixed = 0;
      for (const { id } of live) {
        try {
          if ((await applySubscription(await deps.polar.getSubscription(id))) === "applied") fixed += 1;
        } catch (error) {
          logger.error("billing.reconcile_failed", { subscriptionId: id, error });
        }
      }
      return fixed;
    },

    async createVnpayPayment({ user, plan, interval, ipAddr, returnUrl, locale }) {
      const vnpay = requireVnpay();
      await checkLimit(user.id);
      const amount = deps.plans[plan].prices?.vnd[interval];
      if (!amount) throw new AppError("BILLING_ERROR", `No VND price for ${plan}/${interval}`);
      const [order] = await db
        .insert(billingOrders)
        .values({ ownerId: user.id, provider: "vnpay", plan, interval, amount, currency: "VND", txnRef: crypto.randomUUID().replace(/-/g, "") })
        .returning();
      // The stored createdAt, so reconcileVnpayOrders can query VNPay with the same transaction date.
      const createdAt = order!.createdAt;
      return vnpay.buildPaymentUrl({
        txnRef: order!.txnRef,
        amount,
        // VNPay: no diacritics / special characters.
        orderInfo: `Thanh toan goi ${plan} ${interval === "year" ? "12 thang" : "1 thang"} ${order!.txnRef.slice(0, 8)}`,
        ipAddr,
        returnUrl,
        locale,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + PAYMENT_LINK_MS),
      });
    },

    async handleVnpayIpn(params) {
      return createVnpayIpn({ verify: (p) => requireVnpay().verify(p), handlers: [vnpayIpnHandler], logger })(params);
    },

    vnpayIpnHandler,

    async reconcileVnpayOrders(limit = 50) {
      if (!deps.vnpay) return 0;
      const vnpay = deps.vnpay;
      const t = now().getTime();
      const pending = await db
        .select({ txnRef: billingOrders.txnRef, createdAt: billingOrders.createdAt })
        .from(billingOrders)
        .where(
          and(
            eq(billingOrders.provider, "vnpay"),
            eq(billingOrders.status, "pending"),
            lt(billingOrders.createdAt, new Date(t - PAYMENT_LINK_MS)),
            gt(billingOrders.createdAt, new Date(t - STALE_ORDER_MS)),
          ),
        )
        .limit(limit);
      let confirmed = 0;
      for (const order of pending) {
        try {
          const result = await vnpay.query(order);
          if (result.status !== "paid") continue;
          if ((await vnpayIpnHandler(result.params))?.RspCode === "00") confirmed += 1;
        } catch (error) {
          logger.error("billing.vnpay_reconcile_failed", { txnRef: order.txnRef, error });
        }
      }
      if (confirmed) logger.warn("billing.vnpay_reconciled", { count: confirmed }); // an IPN was lost
      return confirmed;
    },

    async purgeStaleOrders() {
      const removed = await db
        .delete(billingOrders)
        .where(and(eq(billingOrders.provider, "vnpay"), eq(billingOrders.status, "pending"), lt(billingOrders.createdAt, new Date(now().getTime() - STALE_ORDER_MS))))
        .returning({ id: billingOrders.id });
      if (removed.length) logger.info("billing.stale_orders_purged", { count: removed.length });
      return removed.length;
    },

    async revokeSubscriptionsForUser(userId) {
      const live = await db
        .select({ id: subscriptions.providerSubscriptionId })
        .from(subscriptions)
        .where(and(eq(subscriptions.ownerId, userId), eq(subscriptions.provider, "polar"), inArray(subscriptions.status, [...ENTITLED])));
      for (const { id } of live) {
        // Throws on provider failure: the caller aborts the deletion rather than leave a paying subscription behind.
        await applySubscription(await requirePolar().revokeSubscription(id));
        logger.info("billing.subscription_revoked_on_delete", { subscriptionId: id });
      }
      return live.length;
    },

    async exportForUser(userId) {
      const orders = await db
        .select({
          id: billingOrders.id,
          provider: billingOrders.provider,
          plan: billingOrders.plan,
          interval: billingOrders.interval,
          amount: billingOrders.amount,
          currency: billingOrders.currency,
          status: billingOrders.status,
          paidAt: billingOrders.paidAt,
          createdAt: billingOrders.createdAt,
        })
        .from(billingOrders)
        .where(eq(billingOrders.ownerId, userId));
      const subs = await db
        .select({
          provider: subscriptions.provider,
          plan: subscriptions.plan,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .where(eq(subscriptions.ownerId, userId));
      return { orders, subscriptions: subs };
    },

    async adminOverview(limit = 50) {
      const subs = await db
        .select({
          id: subscriptions.id,
          ownerEmail: users.email,
          plan: subscriptions.plan,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        })
        .from(subscriptions)
        .leftJoin(users, eq(users.id, subscriptions.ownerId))
        .orderBy(desc(subscriptions.updatedAt))
        .limit(limit);
      const orders = await db
        .select({
          id: billingOrders.id,
          ownerEmail: users.email,
          plan: billingOrders.plan,
          interval: billingOrders.interval,
          amount: billingOrders.amount,
          currency: billingOrders.currency,
          status: billingOrders.status,
          createdAt: billingOrders.createdAt,
        })
        .from(billingOrders)
        .leftJoin(users, eq(users.id, billingOrders.ownerId))
        .orderBy(desc(billingOrders.createdAt))
        .limit(limit);
      const problemEvents = await db
        .select({
          id: webhookEvents.id,
          provider: webhookEvents.provider,
          type: webhookEvents.type,
          status: webhookEvents.status,
          attempts: webhookEvents.attempts,
          lastError: webhookEvents.lastError,
          receivedAt: webhookEvents.receivedAt,
        })
        .from(webhookEvents)
        .where(inArray(webhookEvents.status, ["failed", "dead"]))
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(limit);
      return { subscriptions: subs, orders, problemEvents };
    },

    async retryWebhookEvent(eventRowId) {
      const [event] = await db
        .update(webhookEvents)
        .set({ status: "received", attempts: 0, lockedUntil: null })
        .where(and(eq(webhookEvents.id, eventRowId), inArray(webhookEvents.status, ["failed", "dead"])))
        .returning({ id: webhookEvents.id });
      if (!event) return false;
      await deps.jobs.enqueue(PROCESS_WEBHOOK_JOB, { eventRowId: event.id }, { dedupeKey: `webhook:${event.id}`, maxAttempts: MAX_EVENT_ATTEMPTS });
      return true;
    },

    async vnpayReturnStatus(params) {
      if (!requireVnpay().verify(params)) return { valid: false, status: "unknown" };
      const [order] = await db
        .select({ status: billingOrders.status })
        .from(billingOrders)
        .where(and(eq(billingOrders.provider, "vnpay"), eq(billingOrders.txnRef, params.vnp_TxnRef ?? "")));
      return { valid: true, status: order?.status ?? "unknown" };
    },
  };
}
