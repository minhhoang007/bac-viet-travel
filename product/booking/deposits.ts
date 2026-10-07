import { randomBytes } from "node:crypto";
import { and, eq, gt, lte, ne, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import type { OneTimePaymentProvider } from "@/core/ports/payments";
import type { Db } from "@/db/client";
import { bookingPayments, bookings, departures, type Booking, type BookingPayment, type Departure } from "../schema/booking";
import { depositEmails, reconcileAlertEmail } from "./emails";
import { vietnamToday } from "./rules";
import type { BookingService } from "./service";
import { awaitsDeposit, isSold, takesSeats } from "./status";

/** VNPay IPN answer (https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html#code-returnurl). */
export type IpnResult = { RspCode: "00" | "01" | "02" | "04" | "97" | "99"; Message: string };

export type StartDepositResult = { status: "redirect"; url: string } | { status: "not_found" } | { status: "not_payable" };
/** Rest of the total still owed online (D5): paid bookings before departure, not yet settled. */
export function balanceDue(booking: Pick<Booking, "status" | "totalVnd" | "depositVnd" | "balancePaidAt">): number {
  if (!isSold(booking.status) || booking.balancePaidAt) return 0;
  return Math.max(0, booking.totalVnd - booking.depositVnd);
}

export type ChooseTransferResult = { status: "ok" } | { status: "not_found" } | { status: "not_payable" };
/** deposit_paid / refund_due: recorded (and the guest emailed). too_little: less than the deposit, nothing recorded. */
export type ReceiveTransferResult = "deposit_paid" | "refund_due" | "extra" | "not_found" | "not_payable" | "too_little";

/** The transfer note of a booking: its code without the dash (banking apps drop it). */
export const transferNote = (code: string) => code.replace(/^BV-/, "BV");

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
  /** VNPay payment of the rest of the total (D5) for a paid booking, until the departure day. */
  startBalance(input: { code: string; token: string; ipAddr: string; returnUrl: string }): Promise<StartDepositResult>;
  /**
   * The guest pays by bank transfer (VietQR): records a pending transfer and holds the seats for the transfer hold
   * time, so staff have time to see the money arrive.
   */
  chooseTransfer(input: { code: string; token: string }): Promise<ChooseTransferResult>;
  /** Whether the guest chose a bank transfer that staff have not recorded yet. */
  transferPending(bookingId: string): Promise<boolean>;
  /**
   * Staff saw the transfer on the bank account: records the deposit exactly once, like a VNPay IPN (late money with
   * the seats gone becomes refund_due). Callers audit it.
   */
  receiveTransfer(code: string, input: { amountVnd: number; bankRef: string }, links: { siteUrl: string; teamEmail?: string }): Promise<ReceiveTransferResult>;
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
  /** Seats stay held this long once the guest chooses a bank transfer. */
  transferHoldMinutes: number;
  tourTitle: (slug: string, locale: string) => Promise<string>;
  now?: () => Date;
}): DepositService {
  const { db, logger } = deps;
  const now = deps.now ?? (() => new Date());

  const notify = async (booking: Booking, departure: Departure, link: { siteUrl: string; token: string | null; teamEmail?: string }, outcome: "paid" | "refund_due" | "extra" | "balance", amountVnd?: number) => {
    const title = await deps.tourTitle(departure.tourSlug, booking.locale);
    const messages = depositEmails({ booking, departure, title, ...link, outcome, amountVnd });
    for (const message of messages) {
      // A failed email must not fail the IPN (VNPay would retry and we would answer "already confirmed").
      await deps.mail.send(message).catch((error) => logger.error("booking.email_failed", { code: booking.code, kind: message.kind, error }));
    }
  };

  type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
  type Recorded = "deposit_paid" | "refund_due" | "extra" | "balance_paid";
  type Settled = { kind: "duplicate" | "failed" } | { kind: Recorded; booking: Booking; departure: Departure; token: string | null };
  /** The email each recorded payment sends, and whether it names the amount paid (extra money, balance). */
  const SETTLED_EMAIL: Record<Recorded, [Parameters<typeof notify>[3], boolean]> = {
    deposit_paid: ["paid", false],
    refund_due: ["refund_due", false],
    extra: ["extra", true],
    balance_paid: ["balance", true],
  };

  /** Balance (D5): settles the total of a live paid booking; anything else is money to give back. */
  async function recordBalance(tx: Tx, booking: Booking, payment: BookingPayment, at: Date): Promise<{ kind: "balance_paid" | "extra"; booking: Booking }> {
    const live = isSold(booking.status) && !booking.balancePaidAt;
    const [updated] = await tx
      .update(bookings)
      .set(live ? { balancePaidAt: at } : { refundDueVnd: sql`${bookings.refundDueVnd} + ${payment.amountVnd}` })
      .where(eq(bookings.id, booking.id))
      .returning();
    return { kind: live ? "balance_paid" : "extra", booking: updated! };
  }

  /** A deposit arrived. Keep the seats if we still can; never lose the guest's payment. */
  async function recordDeposit(tx: Tx, booking: Booking, departure: Departure, payment: BookingPayment, at: Date): Promise<{ kind: "deposit_paid" | "refund_due" | "extra"; booking: Booking }> {
    // Not waiting for a deposit (already paid by another attempt, or cancelled): the money is extra.
    const waiting = awaitsDeposit(booking.status);
    let kind: "deposit_paid" | "refund_due" | "extra" = waiting ? "deposit_paid" : "extra";
    if (waiting && (booking.status === "expired" || booking.holdExpiresAt <= at)) {
      const [row] = await tx
        .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
        .from(bookings)
        .where(and(eq(bookings.departureId, departure.id), ne(bookings.id, booking.id), takesSeats(at)));
      if (departure.capacity - (row?.taken ?? 0) < booking.seats) kind = "refund_due";
    }
    const [updated] = await tx
      .update(bookings)
      .set(kind === "deposit_paid" ? { status: kind, depositPaidAt: at } : { ...(waiting ? { status: "refund_due" as const } : {}), refundDueVnd: sql`${bookings.refundDueVnd} + ${payment.amountVnd}` })
      .where(eq(bookings.id, booking.id))
      .returning();
    return { kind, booking: updated ?? booking };
  }

  /**
   * Records the result of one pending attempt exactly once (VNPay IPN, querydr, or a transfer staff saw). Money that
   * arrived keeps the seats when it still can; otherwise it is owed back (refund_due). Emails the guest and the team.
   */
  async function settle(
    payment: BookingPayment,
    result: { success: boolean; providerTxnNo: string | null; responseCode: string | null; bankCode: string | null },
    links: { siteUrl: string; teamEmail?: string },
  ): Promise<Settled> {
    const { success, ...fields } = result;
    const outcome: Settled = await db.transaction(async (tx) => {
      const at = now();
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId));
      // Same lock order as holds (departure first), so the two never deadlock.
      const [departure] = await tx.select().from(departures).where(eq(departures.id, b!.departureId)).for("update");
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId)).for("update");
      // Claim the attempt exactly once (a duplicate IPN loses this race and changes nothing).
      const claimed = await tx
        .update(bookingPayments)
        .set({ status: success ? "paid" : "failed", ...fields, paidAt: success ? at : null, linkToken: null })
        .where(and(eq(bookingPayments.id, payment.id), eq(bookingPayments.status, "pending")))
        .returning({ id: bookingPayments.id });
      if (claimed.length === 0) return { kind: "duplicate" as const };
      if (!success) return { kind: "failed" as const };
      const recorded = payment.purpose === "balance" ? await recordBalance(tx, booking!, payment, at) : await recordDeposit(tx, booking!, departure!, payment, at);
      return { ...recorded, departure: departure!, token: payment.linkToken };
    });
    if ("booking" in outcome) {
      const [email, withAmount] = SETTLED_EMAIL[outcome.kind];
      await notify(outcome.booking, outcome.departure, { ...links, token: outcome.token }, email, withAmount ? payment.amountVnd : undefined);
    }
    return outcome;
  }

  /** The IPN once its signature is checked (or a querydr result): confirms the attempt exactly once. */
  async function confirm(params: Record<string, string>, links: { siteUrl: string; teamEmail?: string }): Promise<IpnResult> {
    try {
      const [payment] = await db
        .select()
        .from(bookingPayments)
        .where(and(eq(bookingPayments.txnRef, params.vnp_TxnRef ?? ""), eq(bookingPayments.method, "vnpay")));
      if (!payment) return { RspCode: "01", Message: "Order not found" };
      if (Number(params.vnp_Amount) !== payment.amountVnd * 100) return { RspCode: "04", Message: "Invalid amount" };
      if (payment.status !== "pending") return { RspCode: "02", Message: "Order already confirmed" };
      const success = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
      const outcome = await settle(
        payment,
        { success, providerTxnNo: params.vnp_TransactionNo ?? null, responseCode: params.vnp_ResponseCode ?? null, bankCode: params.vnp_BankCode ?? null },
        links,
      );
      if (outcome.kind === "duplicate") return { RspCode: "02", Message: "Order already confirmed" };
      logger.info("booking.deposit_ipn", { txnRef: payment.txnRef, outcome: outcome.kind });
      return OK("Confirm Success");
    } catch (error) {
      logger.error("booking.deposit_ipn_failed", { error });
      return { RspCode: "99", Message: "Unknown error" };
    }
  }

  /** Whether the booking has a bank transfer the guest chose that staff have not recorded yet. */
  async function transferPending(bookingId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: bookingPayments.id })
      .from(bookingPayments)
      .where(and(eq(bookingPayments.bookingId, bookingId), eq(bookingPayments.method, "transfer"), eq(bookingPayments.status, "pending")));
    return Boolean(row);
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

    async startBalance({ code, token, ipAddr, returnUrl }) {
      if (!deps.vnpay) return { status: "not_payable" };
      const booking = await deps.bookings.getForGuest(code, token);
      if (!booking) return { status: "not_found" };
      const amount = balanceDue(booking);
      const at = now();
      if (amount <= 0 || booking.departure.date < vietnamToday(at)) return { status: "not_payable" };
      const txnRef = `${booking.code.slice(3)}B${randomBytes(5).toString("hex").toUpperCase()}`;
      const [attempt] = await db
        .insert(bookingPayments)
        .values({ bookingId: booking.id, purpose: "balance", txnRef, amountVnd: amount, linkToken: token })
        .returning({ createdAt: bookingPayments.createdAt });
      const url = deps.vnpay.buildPaymentUrl({
        txnRef,
        amount,
        orderInfo: `Thanh toan con lai tour ${booking.code}`,
        ipAddr,
        returnUrl,
        locale: booking.locale === "en" ? "en" : "vi",
        createdAt: attempt!.createdAt,
        expiresAt: new Date(at.getTime() + 15 * 60_000),
      });
      logger.info("booking.balance_started", { code: booking.code, txnRef });
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
        .select({ txnRef: bookingPayments.txnRef, createdAt: bookingPayments.createdAt, code: bookings.code })
        .from(bookingPayments)
        .innerJoin(bookings, eq(bookings.id, bookingPayments.bookingId))
        .where(and(eq(bookingPayments.method, "vnpay"), eq(bookingPayments.status, "pending"), lte(bookings.holdExpiresAt, at), gt(bookingPayments.createdAt, new Date(at.getTime() - DAY_MS))))
        .limit(50);
      const confirmed: string[] = [];
      let failed = 0;
      for (const payment of pending) {
        try {
          const result = await vnpay.query(payment);
          if (result.status === "paid" && (await confirm(result.params, links)).RspCode === "00") confirmed.push(payment.code);
          // Not paid and past VNPay's 15-minute payment window: the guest gave up. Close it, so it is not asked again.
          else if (result.status !== "paid" && payment.createdAt.getTime() < at.getTime() - 20 * 60_000)
            await db.update(bookingPayments).set({ status: "failed" }).where(and(eq(bookingPayments.txnRef, payment.txnRef), eq(bookingPayments.status, "pending")));
        } catch (error) {
          failed += 1;
          logger.error("booking.deposit_reconcile_failed", { txnRef: payment.txnRef, error });
        }
      }
      if (confirmed.length) logger.warn("booking.deposit_reconciled", { count: confirmed.length }); // an IPN was lost
      // Lost IPNs or an unreachable VNPay need a person: tell the team (a failed email only logs).
      if (links.teamEmail && (confirmed.length || failed)) {
        const message = reconcileAlertEmail({ to: links.teamEmail, confirmed, failed });
        await deps.mail.send(message).catch((error) => logger.error("booking.email_failed", { kind: message.kind, error }));
      }
      return confirmed.length;
    },

    async chooseTransfer({ code, token }) {
      const booking = await deps.bookings.getForGuest(code, token);
      if (!booking) return { status: "not_found" };
      if (booking.status !== "held" || booking.isExpired) return { status: "not_payable" };
      const at = now();
      const until = new Date(at.getTime() + deps.transferHoldMinutes * 60_000);
      await db.transaction(async (tx) => {
        // One transfer attempt per booking; choosing again keeps it (and its token for the paid email).
        await tx
          .insert(bookingPayments)
          .values({ bookingId: booking.id, method: "transfer", txnRef: `${transferNote(booking.code)}CK`, amountVnd: booking.depositVnd, linkToken: token })
          .onConflictDoNothing();
        // Extend only a live hold, never shorten it.
        await tx
          .update(bookings)
          .set({ holdExpiresAt: sql`greatest(${bookings.holdExpiresAt}, ${until.toISOString()}::timestamptz)` })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "held"), gt(bookings.holdExpiresAt, at)));
      });
      logger.info("booking.transfer_chosen", { code: booking.code });
      return { status: "ok" };
    },

    transferPending,

    async receiveTransfer(code, { amountVnd, bankRef }, links) {
      const [booking] = await db.select().from(bookings).where(eq(bookings.code, code));
      if (!booking) return "not_found";
      const txnRef = `${transferNote(booking.code)}CK`;
      const waiting = awaitsDeposit(booking.status);
      // After another payment (or a cancellation), only a transfer the guest chose can still arrive: it is owed back.
      if (!waiting && !(await transferPending(booking.id))) return "not_payable";
      if (!Number.isInteger(amountVnd) || amountVnd <= 0 || (waiting && amountVnd < booking.depositVnd)) return "too_little";
      // The guest may have transferred without choosing it on the site: staff record it all the same.
      await db.insert(bookingPayments).values({ bookingId: booking.id, method: "transfer", txnRef, amountVnd }).onConflictDoNothing();
      const [payment] = await db
        .update(bookingPayments)
        .set({ amountVnd })
        .where(and(eq(bookingPayments.txnRef, txnRef), eq(bookingPayments.status, "pending")))
        .returning();
      if (!payment) return "not_payable"; // already recorded
      const outcome = await settle(payment, { success: true, providerTxnNo: bankRef.trim().slice(0, 100) || null, responseCode: null, bankCode: null }, links);
      logger.info("booking.transfer_received", { code, outcome: outcome.kind });
      // Transfers recorded here are deposits (purpose "deposit"), so "balance_paid" cannot happen.
      return outcome.kind === "duplicate" || outcome.kind === "failed" || outcome.kind === "balance_paid" ? "not_payable" : outcome.kind;
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

