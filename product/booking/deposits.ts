import { randomBytes } from "node:crypto";
import { and, eq, gt, lte, ne, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import type { OneTimePaymentProvider } from "@/core/ports/payments";
import type { Db } from "@/db/client";
import { bookingPayments, bookings, departures, type Booking, type Departure } from "../schema/booking";
import { depositEmails } from "./emails";
import type { BookingService } from "./service";

/** VNPay IPN answer (https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html#code-returnurl). */
export type IpnResult = { RspCode: "00" | "01" | "02" | "04" | "97" | "99"; Message: string };

export type StartDepositResult = { status: "redirect"; url: string } | { status: "not_found" } | { status: "not_payable" };

export interface DepositService {
  /** Creates a payment attempt for a held booking and returns the VNPay URL. */
  start(input: { code: string; token: string; ipAddr: string; returnUrl: string }): Promise<StartDepositResult>;
  /** VNPay server-to-server callback: the only place a deposit becomes paid. */
  handleIpn(params: Record<string, string>, links: { siteUrl: string; teamEmail?: string }): Promise<IpnResult>;
  /**
   * Periodic, before holds expire: asks VNPay (querydr) about attempts still pending whose hold has run out, and
   * confirms the paid ones as the IPN would have (an IPN can be lost). Returns how many were confirmed.
   */
  reconcile(links: { siteUrl: string; teamEmail?: string }): Promise<number>;
  /** Return URL (display only): signature check + what we know about that attempt. */
  returnStatus(params: Record<string, string>): Promise<{ valid: boolean; code?: string; status: "paid" | "failed" | "pending" | "unknown" }>;
}

const OK = (Message: string): IpnResult => ({ RspCode: "00", Message });
const DAY_MS = 24 * 60 * 60_000;

export function createDepositService(deps: {
  db: Db;
  logger: Logger;
  mail: MailPort;
  bookings: BookingService;
  vnpay?: OneTimePaymentProvider;
  tourTitle: (slug: string, locale: string) => Promise<string>;
  now?: () => Date;
}): DepositService {
  const { db, logger } = deps;
  const now = deps.now ?? (() => new Date());

  const notify = async (booking: Booking, departure: Departure, link: { siteUrl: string; token: string | null; teamEmail?: string }, outcome: "paid" | "refund_due") => {
    const title = await deps.tourTitle(departure.tourSlug, booking.locale);
    const messages = depositEmails({ booking, departure, title, ...link, outcome });
    for (const message of messages) {
      // A failed email must not fail the IPN (VNPay would retry and we would answer "already confirmed").
      await deps.mail.send(message).catch((error) => logger.error("booking.email_failed", { code: booking.code, kind: message.kind, error }));
    }
  };

  /** The IPN once its signature is checked (or a querydr result): confirms the attempt exactly once. */
  async function confirm(params: Record<string, string>, links: { siteUrl: string; teamEmail?: string }): Promise<IpnResult> {
    try {
      const [payment] = await db.select().from(bookingPayments).where(eq(bookingPayments.txnRef, params.vnp_TxnRef ?? ""));
      if (!payment) return { RspCode: "01", Message: "Order not found" };
      if (Number(params.vnp_Amount) !== payment.amountVnd * 100) return { RspCode: "04", Message: "Invalid amount" };
      if (payment.status !== "pending") return { RspCode: "02", Message: "Order already confirmed" };
      const success = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";

      const outcome = await db.transaction(async (tx) => {
        const at = now();
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId));
        // Same lock order as holds (departure first), so the two never deadlock.
        const [departure] = await tx.select().from(departures).where(eq(departures.id, b!.departureId)).for("update");
        const [booking] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId)).for("update");
        // Claim the attempt exactly once (a duplicate IPN loses this race and changes nothing).
        const claimed = await tx
          .update(bookingPayments)
          .set({
            status: success ? "paid" : "failed",
            providerTxnNo: params.vnp_TransactionNo ?? null,
            responseCode: params.vnp_ResponseCode ?? null,
            bankCode: params.vnp_BankCode ?? null,
            paidAt: success ? at : null,
            linkToken: null,
          })
          .where(and(eq(bookingPayments.id, payment.id), eq(bookingPayments.status, "pending")))
          .returning({ id: bookingPayments.id, linkToken: bookingPayments.linkToken });
        if (claimed.length === 0) return { kind: "duplicate" as const };
        if (!success) return { kind: "failed" as const };

        // Money arrived. Keep the seats if we still can; never lose the guest's payment.
        let status: Booking["status"] = "deposit_paid";
        if (booking!.status !== "held" && booking!.status !== "expired") status = "refund_due"; // already paid by another attempt, or cancelled
        else if (booking!.status === "expired" || booking!.holdExpiresAt <= at) {
          const [row] = await tx
            .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
            .from(bookings)
            .where(
              and(
                eq(bookings.departureId, departure!.id),
                ne(bookings.id, booking!.id),
                sql`(${bookings.status} in ('deposit_paid', 'confirmed') or (${bookings.status} = 'held' and ${bookings.holdExpiresAt} > ${at.toISOString()}))`,
              ),
            );
          if (departure!.capacity - (row?.taken ?? 0) < booking!.seats) status = "refund_due";
        }
        const [updated] = await tx
          .update(bookings)
          .set(status === "deposit_paid" ? { status, depositPaidAt: at } : { ...(booking!.status === "held" || booking!.status === "expired" ? { status } : {}), refundDueVnd: sql`${bookings.refundDueVnd} + ${payment.amountVnd}` })
          .where(eq(bookings.id, booking!.id))
          .returning();
        return { kind: status, booking: updated ?? booking!, departure: departure!, token: payment.linkToken };
      });

      if (outcome.kind === "duplicate") return { RspCode: "02", Message: "Order already confirmed" };
      logger.info("booking.deposit_ipn", { txnRef: payment.txnRef, outcome: outcome.kind });
      if (outcome.kind === "deposit_paid") await notify(outcome.booking, outcome.departure, { ...links, token: outcome.token }, "paid");
      if (outcome.kind === "refund_due") await notify(outcome.booking, outcome.departure, { ...links, token: outcome.token }, "refund_due");
      return OK("Confirm Success");
    } catch (error) {
      logger.error("booking.deposit_ipn_failed", { error });
      return { RspCode: "99", Message: "Unknown error" };
    }
  }

  return {
    async start({ code, token, ipAddr, returnUrl }) {
      if (!deps.vnpay) return { status: "not_payable" };
      const booking = await deps.bookings.getForGuest(code, token);
      if (!booking) return { status: "not_found" };
      if (booking.status !== "held" || booking.isExpired) return { status: "not_payable" };
      const txnRef = `${booking.code.slice(3)}${randomBytes(6).toString("hex").toUpperCase()}`;
      // The stored createdAt is the vnp_CreateDate, so reconcile can query VNPay with the same transaction date.
      const [attempt] = await db
        .insert(bookingPayments)
        .values({ bookingId: booking.id, txnRef, amountVnd: booking.depositVnd, linkToken: token })
        .returning({ createdAt: bookingPayments.createdAt });
      const createdAt = attempt!.createdAt;
      const url = deps.vnpay.buildPaymentUrl({
        txnRef,
        amount: booking.depositVnd,
        orderInfo: `Dat coc tour ${booking.code}`,
        ipAddr,
        returnUrl,
        locale: booking.locale === "en" ? "en" : "vi",
        createdAt,
        // VNPay refuses payment after this time; never beyond the hold.
        expiresAt: booking.holdExpiresAt,
      });
      logger.info("booking.deposit_started", { code: booking.code, txnRef });
      return { status: "redirect", url };
    },

    async handleIpn(params, links) {
      if (!deps.vnpay?.verify(params)) return { RspCode: "97", Message: "Invalid signature" };
      return confirm(params, links);
    },

    async reconcile(links) {
      if (!deps.vnpay) return 0;
      const vnpay = deps.vnpay;
      const at = now();
      const pending = await db
        .select({ txnRef: bookingPayments.txnRef, createdAt: bookingPayments.createdAt })
        .from(bookingPayments)
        .innerJoin(bookings, eq(bookings.id, bookingPayments.bookingId))
        .where(and(eq(bookingPayments.status, "pending"), lte(bookings.holdExpiresAt, at), gt(bookingPayments.createdAt, new Date(at.getTime() - DAY_MS))))
        .limit(50);
      let confirmed = 0;
      for (const payment of pending) {
        try {
          const result = await vnpay.query(payment);
          if (result.status === "paid" && (await confirm(result.params, links)).RspCode === "00") confirmed += 1;
        } catch (error) {
          logger.error("booking.deposit_reconcile_failed", { txnRef: payment.txnRef, error });
        }
      }
      if (confirmed) logger.warn("booking.deposit_reconciled", { count: confirmed }); // an IPN was lost
      return confirmed;
    },

    async returnStatus(params) {
      if (!deps.vnpay?.verify(params)) return { valid: false, status: "unknown" };
      const [row] = await db
        .select({ status: bookingPayments.status, code: bookings.code })
        .from(bookingPayments)
        .innerJoin(bookings, eq(bookings.id, bookingPayments.bookingId))
        .where(eq(bookingPayments.txnRef, params.vnp_TxnRef ?? ""));
      if (!row) return { valid: true, status: "unknown" };
      // The IPN may arrive after the guest is back: trust VNPay's failure code, wait for the IPN on success.
      const status = row.status === "pending" ? (params.vnp_ResponseCode === "00" ? "pending" : "failed") : row.status;
      return { valid: true, code: row.code, status };
    },
  };
}

