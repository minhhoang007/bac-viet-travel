import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookings, departures, type BookingSource } from "../schema/booking";
import { SOLD_STATUSES } from "./status";


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
        .select({ vnd: sql<number>`coalesce(sum(${bookings.refundDueVnd}), 0)::bigint` })
        .from(bookings)
        .where(and(sql`${bookings.refundDueVnd} > 0`, sql`${bookings.refundedAt} is null`));

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
