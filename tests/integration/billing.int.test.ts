import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { vnpayProvider, vnpaySign } from "@/providers/billing/vnpay";
import { resetDb, testDb } from "./setup/db";
import { testApp } from "./setup/app";
import { WebhookSignatureError, type ProviderSubscription, type SubscriptionProvider } from "@/modules/billing";
import { billingOrders, subscriptions, webhookEvents } from "@/modules/billing/schema";

const handle = testDb();
const db = handle.db;
const DAY = 24 * 60 * 60_000;

// Fake Polar: a body is "signed" when the header matches; payload carries the subscription snapshot.
let liveSubscription: ProviderSubscription | undefined;
const fakePolar: SubscriptionProvider = {
  async verifyWebhook(body, headers) {
    if (headers.get("webhook-signature") !== "valid") throw new WebhookSignatureError();
    const json = JSON.parse(body) as { id: string; type: string; subscription?: ProviderSubscription };
    return { id: json.id, type: json.type, timestamp: new Date().toISOString(), payload: json, subscription: json.subscription };
  },
  createCheckout: async ({ productId, userId }) => ({ url: `https://polar.test/checkout?p=${productId}&u=${userId}` }),
  createPortalSession: async () => ({ url: "https://polar.test/portal" }),
  getSubscription: async () => liveSubscription!,
  revokeSubscription: async (id) => {
    revoked.push(id);
    if (revokeFails) throw new Error("polar down");
    return { ...liveSubscription!, id, status: "canceled", endedAt: new Date().toISOString(), updatedAt: new Date(Date.now() + 1000).toISOString() };
  },
};
const revoked: string[] = [];
let revokeFails = false;
const VNPAY = { tmnCode: "TESTCODE", hashSecret: "TESTSECRETTESTSECRETTESTSECRET12" };

// Billing config enables both providers; the Polar product id comes from env like in production.
const t = testApp(db, { saas: true, env: { POLAR_PRODUCT_PRO_MONTHLY: "prod_pro_month" }, overrides: { billingProviders: { polar: fakePolar, vnpay: vnpayProvider(VNPAY) } } });
const billing = t.container.billing!;
const jobs = t.container.jobs!;
const ent = t.container.entitlements!;

async function user() {
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.com` }).returning();
  return u!.id;
}

function sub(ownerId: string, over: Partial<ProviderSubscription> = {}): ProviderSubscription {
  return {
    id: "sub_1",
    status: "active",
    productId: "prod_pro_month",
    currentPeriodEnd: new Date(Date.now() + 30 * DAY).toISOString(),
    cancelAtPeriodEnd: false,
    endedAt: null,
    externalCustomerId: ownerId,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

const deliver = (id: string, type: string, subscription: ProviderSubscription, signature = "valid") =>
  billing.receivePolarWebhook(JSON.stringify({ id, type, subscription }), new Headers({ "webhook-signature": signature }));

beforeEach(async () => {
  await resetDb(db);
  liveSubscription = undefined;
  revoked.length = 0;
  revokeFails = false;
});
afterAll(() => handle.close());

describe("Polar webhooks (state machine)", () => {
  it("rejects an invalid signature and stores nothing", async () => {
    const owner = await user();
    await expect(deliver("evt_x", "subscription.active", sub(owner), "forged")).rejects.toBeInstanceOf(WebhookSignatureError);
    expect(await db.select().from(webhookEvents)).toHaveLength(0);
  });

  it("stores + enqueues fast, then the job grants Pro until the period end", async () => {
    const owner = await user();
    const s = sub(owner);
    await deliver("evt_1", "subscription.active", s);

    const [event] = await db.select().from(webhookEvents);
    expect(event!.status).toBe("received"); // receiving ≠ processing
    expect((await ent.getAccess(owner)).plan).toBe("free");

    await jobs.runDue();
    expect((await db.select().from(webhookEvents))[0]!.status).toBe("processed");
    const access = await ent.getAccess(owner);
    expect(access.plan).toBe("pro");
    expect(access.endsAt?.toISOString()).toBe(s.currentPeriodEnd);
  });

  it("a duplicate delivery is stored once and processed once", async () => {
    const owner = await user();
    const s = sub(owner);
    const a = await deliver("evt_dup", "subscription.active", s);
    const b = await deliver("evt_dup", "subscription.active", s);
    expect(b).toEqual({ eventRowId: a.eventRowId, duplicate: true });
    expect(await db.select().from(webhookEvents)).toHaveLength(1);
    expect((await jobs.runDue()).succeeded).toBe(1);

    // Redelivery after processing: acknowledged, no new job.
    await deliver("evt_dup", "subscription.active", s);
    expect((await jobs.runDue()).claimed).toBe(0);
  });

  it("an older event arriving after a newer one does not overwrite state", async () => {
    const owner = await user();
    const newer = sub(owner, { status: "canceled", cancelAtPeriodEnd: false, updatedAt: "2026-10-02T00:00:00Z" });
    const older = sub(owner, { status: "active", updatedAt: "2026-10-01T00:00:00Z" });
    await deliver("evt_new", "subscription.canceled", newer);
    await jobs.runDue();
    await deliver("evt_old", "subscription.active", older);
    await jobs.runDue();

    const [row] = await db.select().from(subscriptions);
    expect(row!.status).toBe("canceled");
    expect((await ent.getAccess(owner)).plan).toBe("free");
    expect((await db.select().from(webhookEvents)).every((e) => e.status === "processed")).toBe(true);
  });

  it("cancel at period end keeps access until the period ends; revoke ends it now", async () => {
    const owner = await user();
    const end = new Date(Date.now() + 10 * DAY).toISOString();
    await deliver("e1", "subscription.canceled", sub(owner, { status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: end, updatedAt: "2026-10-01T00:00:00Z" }));
    await jobs.runDue();
    expect((await ent.getAccess(owner)).endsAt?.toISOString()).toBe(end);

    await deliver("e2", "subscription.revoked", sub(owner, { status: "canceled", endedAt: new Date().toISOString(), updatedAt: "2026-10-01T01:00:00Z" }));
    await jobs.runDue();
    expect((await ent.getAccess(owner)).plan).toBe("free");
  });

  it("crash after storing the event (no job ran): the sweeper re-queues and it gets processed", async () => {
    const owner = await user();
    await db.insert(webhookEvents).values({
      provider: "polar",
      eventId: "evt_orphan",
      type: "subscription.active",
      payload: { subscription: sub(owner), raw: {} },
      receivedAt: new Date(Date.now() - 10 * 60_000),
    });
    expect(await billing.sweepWebhookEvents()).toBe(1);
    await jobs.runDue();
    expect((await db.select().from(webhookEvents))[0]!.status).toBe("processed");
    expect((await ent.getAccess(owner)).plan).toBe("pro");
  });

  it("a stuck 'processing' event with an expired lease is picked up again", async () => {
    const owner = await user();
    const [row] = await db
      .insert(webhookEvents)
      .values({ provider: "polar", eventId: "evt_stuck", type: "subscription.active", payload: { subscription: sub(owner), raw: {} }, status: "processing", attempts: 1, lockedUntil: sql`now() - interval '1 minute'` })
      .returning();
    await billing.sweepWebhookEvents();
    await jobs.runDue();
    const [after] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, row!.id));
    expect(after).toMatchObject({ status: "processed", attempts: 2 });
  });

  it("a poison event ends as dead after max attempts, visible for admins", async () => {
    await db.insert(webhookEvents).values({ provider: "polar", eventId: "evt_bad", type: "subscription.active", payload: { raw: {} } });
    await billing.sweepWebhookEvents(); // received but young → not swept yet
    const [event] = await db.select().from(webhookEvents);
    for (let i = 0; i < 8; i++) {
      await billing.processWebhookEvent(event!.id).catch(() => {});
    }
    const [dead] = await db.select().from(webhookEvents);
    expect(dead).toMatchObject({ status: "dead", attempts: 8, lastError: "subscription payload missing" });
  });

  it("reconcile repairs drift from the provider's live state", async () => {
    const owner = await user();
    await deliver("e1", "subscription.active", sub(owner, { updatedAt: "2026-10-01T00:00:00Z" }));
    await jobs.runDue();
    // Provider says it was revoked, but we missed the webhook.
    liveSubscription = sub(owner, { status: "unpaid", updatedAt: "2026-10-05T00:00:00Z" });
    expect(await billing.reconcileSubscriptions()).toBe(1);
    expect((await ent.getAccess(owner)).plan).toBe("free");
  });

  it("checkout uses the configured product and the user id as external customer", async () => {
    const url = await billing.createPolarCheckout({ id: "u1", email: "a@example.com" }, "pro", "month", "https://x/ok");
    expect(url).toBe("https://polar.test/checkout?p=prod_pro_month&u=u1");
  });
});

describe("account lifecycle with billing", () => {
  it("deleting the account revokes the live Polar subscription first", async () => {
    const owner = await user();
    liveSubscription = sub(owner);
    await deliver("e1", "subscription.active", liveSubscription);
    await jobs.runDue();

    await t.app.account.deleteAccount(owner);
    expect(revoked).toEqual(["sub_1"]);
    const [row] = await db.select().from(subscriptions);
    expect(row).toMatchObject({ status: "canceled", ownerId: null }); // kept for accounting, anonymized
  });

  it("if the provider cannot revoke, the account is NOT deleted", async () => {
    const owner = await user();
    liveSubscription = sub(owner);
    await deliver("e1", "subscription.active", liveSubscription);
    await jobs.runDue();
    revokeFails = true;

    await expect(t.app.account.deleteAccount(owner)).rejects.toThrow("polar down");
    expect(await db.select().from(users).where(eq(users.id, owner))).toHaveLength(1);
  });

  it("account export includes billing records without provider payloads", async () => {
    const owner = await user();
    await deliver("e1", "subscription.active", sub(owner));
    await jobs.runDue();
    const data = (await t.app.account.exportAccount(owner)) as { billing: { subscriptions: unknown[]; orders: unknown[] } };
    expect(data.billing.subscriptions).toEqual([expect.objectContaining({ provider: "polar", plan: "pro", status: "active" })]);
    expect(JSON.stringify(data)).not.toContain("providerResponse");
  });
});

describe("VNPay (one-time period purchase)", () => {
  const signedIpn = (params: Record<string, string>) => ({ ...params, vnp_SecureHash: vnpaySign(params, VNPAY.hashSecret) });

  async function order(owner: string) {
    const url = await billing.createVnpayPayment({ user: { id: owner }, plan: "pro", interval: "month", ipAddr: "203.0.113.1", returnUrl: "https://x/return", locale: "vi" });
    const params = Object.fromEntries(new URL(url).searchParams);
    return { url, params, txnRef: params.vnp_TxnRef! };
  }
  const ipnFor = (txnRef: string, over: Record<string, string> = {}) =>
    signedIpn({
      vnp_TmnCode: VNPAY.tmnCode,
      vnp_Amount: String(199_000 * 100),
      vnp_TxnRef: txnRef,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TransactionNo: "14000000",
      vnp_OrderInfo: "Thanh toan goi pro",
      ...over,
    });

  it("payment URL is signed and carries the price x100 in VND", async () => {
    const owner = await user();
    const { params } = await order(owner);
    expect(params).toMatchObject({ vnp_Amount: "19900000", vnp_CurrCode: "VND", vnp_Command: "pay", vnp_Locale: "vn" });
    expect(vnpayProvider(VNPAY).verify(params)).toBe(true);
    const [row] = await db.select().from(billingOrders);
    expect(row).toMatchObject({ status: "pending", amount: 199_000, ownerId: owner });
  });

  it("IPN: bad signature 97, unknown order 01, wrong amount 04", async () => {
    const owner = await user();
    const { txnRef } = await order(owner);
    expect(await billing.handleVnpayIpn({ ...ipnFor(txnRef), vnp_Amount: "1" })).toMatchObject({ RspCode: "97" });
    expect(await billing.handleVnpayIpn(ipnFor("nope"))).toMatchObject({ RspCode: "01" });
    expect(await billing.handleVnpayIpn(ipnFor(txnRef, { vnp_Amount: "100" }))).toMatchObject({ RspCode: "04" });
    expect((await ent.getAccess(owner)).plan).toBe("free");
  });

  it("IPN success grants 30 days once; a repeated IPN answers 02", async () => {
    const owner = await user();
    const { txnRef } = await order(owner);
    expect(await billing.handleVnpayIpn(ipnFor(txnRef))).toEqual({ RspCode: "00", Message: "Confirm Success" });
    const access = await ent.getAccess(owner);
    expect(access.plan).toBe("pro");
    expect(access.endsAt!.getTime() - Date.now()).toBeGreaterThan(29 * DAY);
    expect(await billing.handleVnpayIpn(ipnFor(txnRef))).toMatchObject({ RspCode: "02" });
    expect(await billing.vnpayReturnStatus(ipnFor(txnRef))).toEqual({ valid: true, status: "paid" });
  });

  it("a failed payment is recorded without access", async () => {
    const owner = await user();
    const { txnRef } = await order(owner);
    expect(await billing.handleVnpayIpn(ipnFor(txnRef, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }))).toMatchObject({ RspCode: "00" });
    expect((await db.select().from(billingOrders))[0]!.status).toBe("failed");
    expect((await ent.getAccess(owner)).plan).toBe("free");
  });

  it("two purchases stack to 60 days", async () => {
    const owner = await user();
    for (const { txnRef } of [await order(owner), await order(owner)]) await billing.handleVnpayIpn(ipnFor(txnRef));
    expect((await ent.getAccess(owner)).endsAt!.getTime() - Date.now()).toBeGreaterThan(59 * DAY);
  });

  it("the container endpoint verifies and confirms billing orders (rc.15)", async () => {
    const owner = await user();
    const { txnRef } = await order(owner);
    expect(await t.container.handleVnpayIpn!({ ...ipnFor(txnRef), vnp_Amount: "1" })).toMatchObject({ RspCode: "97" });
    expect(await t.container.handleVnpayIpn!(ipnFor(txnRef))).toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect((await ent.getAccess(owner)).plan).toBe("pro");
  });

  it("limits payment creation per user: the 11th attempt in 10 minutes is refused (rc.15)", async () => {
    const owner = await user();
    for (let i = 0; i < 10; i++) await order(owner);
    await expect(order(owner)).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
    await expect(billing.createPolarPortal(owner, "https://x")).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
    await order(await user()); // another user is not affected
    expect(await db.$count(billingOrders)).toBe(11);
  });

  it("purges VNPay orders still pending after a day; keeps recent and settled ones (rc.15)", async () => {
    const owner = await user();
    const [stale, recent, paid] = [await order(owner), await order(owner), await order(owner)];
    await billing.handleVnpayIpn(ipnFor(paid.txnRef));
    const old = new Date(Date.now() - 2 * DAY);
    await db.update(billingOrders).set({ createdAt: old }).where(inArray(billingOrders.txnRef, [stale.txnRef, paid.txnRef]));
    expect(await billing.purgeStaleOrders()).toBe(1);
    const left = await db.select({ txnRef: billingOrders.txnRef }).from(billingOrders);
    expect(left.map((r) => r.txnRef).sort()).toEqual([recent.txnRef, paid.txnRef].sort());
  });

  it("account deletion keeps the financial record, anonymized", async () => {
    const owner = await user();
    const { txnRef } = await order(owner);
    await billing.handleVnpayIpn(ipnFor(txnRef));
    await t.app.account.deleteAccount(owner);
    const [row] = await db.select().from(billingOrders);
    expect(row).toMatchObject({ status: "paid", ownerId: null });
  });
});
