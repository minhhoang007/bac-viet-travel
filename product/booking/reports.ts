import { and, asc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookingLedger, bookings, departures, type BookingSource } from "../schema/booking";
import { addDays, vietnamDayStart } from "./rules";
import { refundOwed, SOLD_STATUSES } from "./status";

/** How money came into the company: online (VNPay), bank transfer recorded by staff, or cash staff recorded. */
export type CashChannel = "vnpay" | "transfer" | "staff";

export interface CashReport {
  byChannel: { channel: CashChannel; inVnd: number }[];
  /** Collected by OTAs for their bookings: not in the company account yet, so not in `collectedVnd`. */
  otaVnd: number;
  /** Admin corrections (+ or −), included in `collectedVnd`. */
  adjustVnd: number;
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
  return {
    /**
     * Money by the day it moved (Vietnam days, inclusive), from the ledger: money in per channel into the company
     * (OTA collections apart: the OTA pays out later), admin corrections, and refunds paid out. Money in minus
     * refunds matches the bank.
     */
    async cash(from: string, to: string): Promise<CashReport> {
      const rows = await db
        .select({ kind: bookingLedger.kind, channel: bookingLedger.channel, vnd: sql<number>`coalesce(sum(${bookingLedger.amountVnd}), 0)::bigint` })
        .from(bookingLedger)
        .where(and(gte(bookingLedger.at, vietnamDayStart(from)), lt(bookingLedger.at, vietnamDayStart(addDays(to, 1)))))
        .groupBy(bookingLedger.kind, bookingLedger.channel);
      const total = (kind: string, channel?: string) => rows.filter((r) => r.kind === kind && (!channel || r.channel === channel)).reduce((n, r) => n + Number(r.vnd), 0);
      const byChannel = (["vnpay", "transfer", "staff"] as const).map((channel) => ({ channel, inVnd: total("in", channel) })).filter((r) => r.inVnd > 0);
      const adjustVnd = total("adjust");
      return { byChannel, otaVnd: total("in", "ota"), adjustVnd, collectedVnd: byChannel.reduce((n, r) => n + r.inVnd, 0) + adjustVnd, refundedVnd: total("refund") };
    },

    /** Sold bookings for trips from `today` on whose balance is not paid yet: who to collect from, by trip date. */
    async receivables(today: string): Promise<ReceivableRow[]> {
      // Total minus what is kept (ledger): owedVnd in lifecycle.ts.
      const owed = sql`${bookings.totalVnd} - (${bookings.receivedVnd} - ${bookings.refundDueVnd})`;
      const rows = await db
        .select({
          code: bookings.code,
          name: bookings.name,
          phone: bookings.phone,
          tourSlug: departures.tourSlug,
          date: departures.date,
          dueVnd: sql<number>`${owed}`,
        })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(and(inArray(bookings.status, SOLD_STATUSES), isNull(bookings.balancePaidAt), sql`${owed} > 0`, gte(departures.date, today)))
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
