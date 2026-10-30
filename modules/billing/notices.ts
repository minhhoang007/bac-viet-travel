import { and, eq, gte, isNotNull, notExists, sql } from "drizzle-orm";
import { users } from "@/core/users/schema";
import type { Logger } from "@/core/logger";
import type { MailMessage } from "@/core/ports/mail";
import type { Db } from "@/db/client";
import type { PlanDefinition, PlanId } from "@/config/billing.defaults";
import type { EntitlementsModule } from "@/modules/entitlements";
import { billingNotices, billingOrders } from "./schema";

export const SEND_NOTICES_JOB = "billing.send_notices";
const DAY_MS = 24 * 60 * 60_000;
/** Only events this recent get an email: upgrading a project never mails its customers about old payments. */
const RECENT_MS = 2 * DAY_MS;
const REMINDER_DAYS = [1, 3, 7] as const;
const BATCH = 200;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Kind = (typeof billingNotices.$inferInsert)["kind"];

export interface BillingNoticeDeps {
  db: Db;
  logger: Logger;
  entitlements: EntitlementsModule;
  plans: Record<PlanId, PlanDefinition>;
  /** Queues an email job inside `tx` (the email module's send job), so claim and email commit together. */
  queueEmail(message: MailMessage, tx: Tx): Promise<void>;
  siteUrl: string;
  brand: string;
  now?: () => Date;
}

const date = (d: Date, locale: "vi-VN" | "en-GB") => d.toLocaleDateString(locale, { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
const both = (vi: string, en: string) => `${vi}\n\n---\n\n${en}`;

/**
 * Billing lifecycle emails (bilingual, no locale is stored per user): VNPay receipt, welcome on the first paid plan,
 * renewal reminders 7/3/1 days before a VNPay period ends (VNPay does not renew by itself), and "access ended".
 * Scans state, so a missed run catches up; billing_notices makes every email go out once.
 */
export function createBillingNotices(deps: BillingNoticeDeps) {
  const now = deps.now ?? (() => new Date());
  const billingUrl = `${deps.siteUrl.replace(/\/$/, "")}/dashboard/billing`;
  const planName = (plan: string) => deps.plans[plan as PlanId]?.name ?? { vi: plan, en: plan };

  /** Claims (kind, ref) and queues the email in one transaction. False when it was already sent. */
  const notify = async (ownerId: string, kind: Kind, ref: string, build: () => Omit<MailMessage, "to" | "kind">) =>
    deps.db.transaction(async (tx) => {
      const [claimed] = await tx.insert(billingNotices).values({ ownerId, kind, ref }).onConflictDoNothing().returning({ id: billingNotices.id });
      if (!claimed) return false;
      const [user] = await tx.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, ownerId));
      // A disabled or deleted account keeps the claim (nothing to send later either).
      if (user?.status === "active") await deps.queueEmail({ kind: `billing.${kind}`, to: user.email, ...build() }, tx);
      return true;
    });

  async function receipts(t: Date): Promise<number> {
    const orders = await deps.db
      .select()
      .from(billingOrders)
      .where(
        and(
          eq(billingOrders.provider, "vnpay"),
          eq(billingOrders.status, "paid"),
          isNotNull(billingOrders.ownerId),
          gte(billingOrders.paidAt, new Date(t.getTime() - RECENT_MS)),
          notExists(deps.db.select().from(billingNotices).where(and(eq(billingNotices.kind, "receipt"), eq(billingNotices.ref, sql`${billingOrders.id}::text`)))),
        ),
      )
      .limit(BATCH);
    let sent = 0;
    for (const o of orders) {
      const name = planName(o.plan);
      const paid = o.paidAt ?? t;
      const ok = await notify(o.ownerId!, "receipt", o.id, () => ({
        subject: `Biên nhận thanh toán ${deps.brand} / Payment receipt`,
        text: both(
          `Cảm ơn bạn đã thanh toán.\n\nGói: ${name.vi} (${o.interval === "year" ? "1 năm" : "1 tháng"})\nSố tiền: ${o.amount.toLocaleString("vi-VN")} ${o.currency}\nMã đơn: ${o.txnRef}\nMã giao dịch VNPay: ${o.providerTransactionId ?? "-"}\nNgày: ${date(paid, "vi-VN")}\n\nXem gói của bạn: ${billingUrl}`,
          `Thank you for your payment.\n\nPlan: ${name.en} (${o.interval === "year" ? "1 year" : "1 month"})\nAmount: ${o.amount.toLocaleString("en-US")} ${o.currency}\nOrder: ${o.txnRef}\nVNPay transaction: ${o.providerTransactionId ?? "-"}\nDate: ${date(paid, "en-GB")}\n\nYour plan: ${billingUrl}`,
        ),
      }));
      if (ok) sent += 1;
    }
    return sent;
  }

  async function welcomes(t: Date): Promise<number> {
    let sent = 0;
    for (const { ownerId, plan } of (await deps.entitlements.newPaidOwners(new Date(t.getTime() - RECENT_MS))).slice(0, BATCH)) {
      const name = planName(plan);
      const ok = await notify(ownerId, "welcome", ownerId, () => ({
        subject: `Chào mừng bạn đến với ${deps.brand} ${name.vi} / Welcome`,
        text: both(
          `Chào mừng bạn đến với gói ${name.vi} của ${deps.brand}. Mọi tính năng của gói đã được mở.\n\nQuản lý gói và thanh toán: ${billingUrl}\n\nCần hỗ trợ? Trả lời email này.`,
          `Welcome to ${deps.brand} ${name.en}. Every feature of your plan is now unlocked.\n\nManage your plan and payments: ${billingUrl}\n\nNeed help? Reply to this email.`,
        ),
      }));
      if (ok) sent += 1;
    }
    return sent;
  }

  async function reminders(t: Date): Promise<number> {
    const ending = await deps.entitlements.endingGrants({ from: t, to: new Date(t.getTime() + 7 * DAY_MS), sources: ["vnpay_order"] });
    let sent = 0;
    for (const g of ending.filter((g) => !g.coveredAfter).slice(0, BATCH)) {
      const daysLeft = Math.ceil((g.endsAt.getTime() - t.getTime()) / DAY_MS);
      const bucket = REMINDER_DAYS.find((d) => d >= daysLeft) ?? 7;
      const name = planName(g.plan);
      const ok = await notify(g.ownerId, "renewal_reminder", `${g.id}:${bucket}`, () => ({
        subject: `Gói ${name.vi} hết hạn sau ${daysLeft} ngày / Your plan ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        text: both(
          `Gói ${name.vi} của bạn hết hạn ngày ${date(g.endsAt, "vi-VN")}. Thanh toán qua VNPay không tự gia hạn: gia hạn trước ngày này để không bị gián đoạn.\n\nGia hạn: ${billingUrl}`,
          `Your ${name.en} plan ends on ${date(g.endsAt, "en-GB")}. VNPay payments do not renew by themselves: renew before then to keep access.\n\nRenew: ${billingUrl}`,
        ),
      }));
      if (ok) sent += 1;
    }
    return sent;
  }

  async function endings(t: Date): Promise<number> {
    const ended = await deps.entitlements.endingGrants({ from: new Date(t.getTime() - RECENT_MS), to: t });
    let sent = 0;
    for (const g of ended.filter((g) => !g.coveredAfter).slice(0, BATCH)) {
      const name = planName(g.plan);
      const ok = await notify(g.ownerId, "access_ended", g.id, () => ({
        subject: `Gói ${name.vi} đã hết hạn / Your plan has ended`,
        text: both(
          `Gói ${name.vi} của bạn đã hết hạn ngày ${date(g.endsAt, "vi-VN")}. Tài khoản đã về gói miễn phí; dữ liệu của bạn vẫn được giữ.\n\nĐăng ký lại: ${billingUrl}`,
          `Your ${name.en} plan ended on ${date(g.endsAt, "en-GB")}. Your account is back on the free plan; your data is kept.\n\nSubscribe again: ${billingUrl}`,
        ),
      }));
      if (ok) sent += 1;
    }
    return sent;
  }

  return {
    /** Periodic / job: queue every lifecycle email that is due. Returns how many were queued. */
    async sendDue(): Promise<number> {
      const t = now();
      const counts = { receipt: await receipts(t), welcome: await welcomes(t), reminder: await reminders(t), ended: await endings(t) };
      const total = counts.receipt + counts.welcome + counts.reminder + counts.ended;
      if (total > 0) deps.logger.info("billing.notices_queued", counts);
      return total;
    },
  };
}

export type BillingNotices = ReturnType<typeof createBillingNotices>;
