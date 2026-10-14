import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, not, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookingPayments, bookings, departures, type BookingSource } from "../schema/booking";
import { addDays, vietnamDayStart } from "./rules";
import { refundOwed, SOLD_STATUSES } from "./status";

/** How money came in: online (VNPay), bank transfer recorded by staff, or other money staff recorded (cash, OTA). */
export type CashChannel = "vnpay" | "transfer" | "staff";

export interface CashReport {
  byChannel: { channel: CashChannel; depositsVnd: number; balancesVnd: number }[];
  /**
   * Money received that is not a deposit or balance: a deposit that came after the seats were gone, a second
   * transfer, a payment for a cancelled booking. Owed back, but it did come in (in `collectedVnd`), and its refund
   * is in `refundedVnd`.
   */
  extraVnd: number;
  collectedVnd: number;
  /** Refunds paid out in the period. */
  refundedVnd: number;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-10" → the first and last day of a range of months (defaults: this month; `to` never before `from`). */
export function monthRange(q: { from?: string; to?: string }, today: string) {
  const fromMonth = q.from && MONTH.test(q.from) ? q.from : today.slice(0, 7);
  const toMonth = q.to && MONTH.test(q.to) && q.to >= fromMonth ? q.to : fromMonth;
  const [y, m] = toMonth.split("-").map(Number) as [number, number];
  const to = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
  return { fromMonth, toMonth, from: `${fromMonth}-01`, to };
}

export interface ReceivableRow {
  code: string;
  name: string;
  phone: string;
  tourSlug: string;
  date: string;
  dueVnd: number;
}


export interface TourReportRow {
  tourSlug: string;
  departures: number;
  capacity: number;
  seats: number;
  bookings: number;
  /** Sum of booking totals (VND) and of deposits paid. */
  revenueVnd: number;
  depositsVnd: number;
}

export interface Report {
  from: string;
  to: string;
  tours: TourReportRow[];
  sources: { source: BookingSource; bookings: number; seats: number; revenueVnd: number }[];
  /** Money owed back and not refunded yet (any departure date). */
  refundsOwedVnd: number;
}

/**
 * Sales report (H3) for departures between two days (inclusive): per tour (group departures: capacity and fill rate;
 * private departures count their seats), per booking source, and refunds still owed.
 */
export function createReports(deps: { db: Db }) {
  const { db } = deps;
  // The channel of a booking's paid deposit or balance; none recorded means staff entered the money by hand.
  // Columns are written with their table: Drizzle leaves them bare in a one-table query, and a bare "id" inside the
  // subquery would mean booking_payments.id.
  const channel = (purpose: "deposit" | "balance") =>
    sql<CashChannel>`coalesce((select p.method from booking_payments p where p.booking_id = bookings.id and p.purpose = ${purpose} and p.status = 'paid' order by p.paid_at limit 1), 'staff')`;
  return {
    /**
     * Money in by the day it arrived (Vietnam days, inclusive), the same rule as the dashboard's "collected":
     * deposits by deposit date, balances (total − deposit) by balance date; plus the extra money that came in (to be
     * given back), so that money in minus refunds matches the bank; refunds paid out by refund date.
     */
    async cash(from: string, to: string): Promise<CashReport> {
      const start = vietnamDayStart(from);
      const end = vietnamDayStart(addDays(to, 1));
      // A payment that settled a deposit or balance stamps the booking with its own paid time (deposits.ts settle).
      const counted = or(
        and(eq(bookingPayments.purpose, "deposit"), eq(bookings.depositPaidAt, bookingPayments.paidAt)),
        and(eq(bookingPayments.purpose, "balance"), eq(bookings.balancePaidAt, bookingPayments.paidAt)),
      );
      const [deposits, balances, [extra], [refunded]] = await Promise.all([
        db.select({ channel: channel("deposit"), vnd: bookings.depositVnd }).from(bookings).where(and(gte(bookings.depositPaidAt, start), lt(bookings.depositPaidAt, end))),
        db.select({ channel: channel("balance"), vnd: sql<number>`${bookings.totalVnd} - ${bookings.depositVnd}` }).from(bookings).where(and(gte(bookings.balancePaidAt, start), lt(bookings.balancePaidAt, end))),
        db
          .select({ vnd: sql<number>`coalesce(sum(${bookingPayments.amountVnd}), 0)::bigint` })
          .from(bookingPayments)
          .innerJoin(bookings, eq(bookings.id, bookingPayments.bookingId))
          .where(and(eq(bookingPayments.status, "paid"), gte(bookingPayments.paidAt, start), lt(bookingPayments.paidAt, end), not(counted!))),
        db.select({ vnd: sql<number>`coalesce(sum(${bookings.refundedVnd}), 0)::bigint` }).from(bookings).where(and(gte(bookings.refundedAt, start), lt(bookings.refundedAt, end))),
      ]);
      const byChannel = (["vnpay", "transfer", "staff"] as const)
        .map((ch) => ({
          channel: ch,
          depositsVnd: deposits.filter((r) => r.channel === ch).reduce((n, r) => n + Number(r.vnd), 0),
          balancesVnd: balances.filter((r) => r.channel === ch).reduce((n, r) => n + Number(r.vnd), 0),
        }))
        .filter((r) => r.depositsVnd + r.balancesVnd > 0);
      const extraVnd = Number(extra?.vnd ?? 0);
      return { byChannel, extraVnd, collectedVnd: byChannel.reduce((n, r) => n + r.depositsVnd + r.balancesVnd, 0) + extraVnd, refundedVnd: Number(refunded?.vnd ?? 0) };
    },

    /** Sold bookings for trips from `today` on whose balance is not paid yet: who to collect from, by trip date. */
    async receivables(today: string): Promise<ReceivableRow[]> {
      const rows = await db
        .select({
          code: bookings.code,
          name: bookings.name,
          phone: bookings.phone,
          tourSlug: departures.tourSlug,
          date: departures.date,
          dueVnd: sql<number>`${bookings.totalVnd} - ${bookings.depositVnd}`,
        })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(and(inArray(bookings.status, SOLD_STATUSES), isNull(bookings.balancePaidAt), gt(bookings.totalVnd, bookings.depositVnd), gte(departures.date, today)))
        .orderBy(asc(departures.date), asc(bookings.code))
        .limit(500);
      return rows.map((r) => ({ ...r, dueVnd: Number(r.dueVnd) }));
    },

    async report(from: string, to: string): Promise<Report> {
      const inRange = and(gte(departures.date, from), lte(departures.date, to));
      // Capacity per tour from departures (one row each), sales from their sold bookings: two queries, no double count.
      const capacity = await db
        .select({ tourSlug: departures.tourSlug, departures: sql<number>`count(*)::int`, capacity: sql<number>`coalesce(sum(${departures.capacity}), 0)::int` })
        .from(departures)
        .where(and(inRange, eq(departures.kind, "group")))
        .groupBy(departures.tourSlug);
      const sales = await db
        .select({
          tourSlug: departures.tourSlug,
          bookings: sql<number>`count(*)::int`,
          seats: sql<number>`coalesce(sum(${bookings.seats}), 0)::int`,
          revenueVnd: sql<number>`coalesce(sum(${bookings.totalVnd}), 0)::bigint`,
          depositsVnd: sql<number>`coalesce(sum(${bookings.depositVnd}), 0)::bigint`,
        })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(and(inRange, inArray(bookings.status, SOLD_STATUSES)))
        .groupBy(departures.tourSlug);
      const sources = await db
        .select({
          source: bookings.source,
          bookings: sql<number>`count(*)::int`,
          seats: sql<number>`coalesce(sum(${bookings.seats}), 0)::int`,
          revenueVnd: sql<number>`coalesce(sum(${bookings.totalVnd}), 0)::bigint`,
        })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(and(inRange, inArray(bookings.status, SOLD_STATUSES)))
        .groupBy(bookings.source);
      const [owed] = await db
        .select({ vnd: sql<number>`coalesce(sum(${bookings.refundDueVnd} - ${bookings.refundedVnd}), 0)::bigint` })
        .from(bookings)
        .where(refundOwed());

      const slugs = [...new Set([...capacity.map((r) => r.tourSlug), ...sales.map((r) => r.tourSlug)])];
      const tours = slugs
        .map((tourSlug) => {
          const c = capacity.find((r) => r.tourSlug === tourSlug);
          const s = sales.find((r) => r.tourSlug === tourSlug);
          return {
            tourSlug,
            departures: c?.departures ?? 0,
            capacity: c?.capacity ?? 0,
            seats: s?.seats ?? 0,
            bookings: s?.bookings ?? 0,
            revenueVnd: Number(s?.revenueVnd ?? 0),
            depositsVnd: Number(s?.depositsVnd ?? 0),
          };
        })
        .sort((a, b) => b.revenueVnd - a.revenueVnd || a.tourSlug.localeCompare(b.tourSlug));
      return {
        from,
        to,
        tours,
        sources: sources.map((r) => ({ ...r, revenueVnd: Number(r.revenueVnd) })).sort((a, b) => b.revenueVnd - a.revenueVnd),
        refundsOwedVnd: Number(owed?.vnd ?? 0),
      };
    },
  };
}
export type Reports = ReturnType<typeof createReports>;
