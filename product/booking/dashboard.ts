import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookingPayments, bookings, departures } from "../schema/booking";
import { needsAttention } from "./admin";
import { addDays, vietnamDayStart, vietnamToday } from "./rules";
import { canBecome, SOLD_STATUSES } from "./status";

const DAY = 86_400_000;
const TZ = "Asia/Ho_Chi_Minh";

export interface DashboardData {
  /** Money received (deposits + balances, by the day it came in), this month to date vs the same days last month. */
  collected: { month: number; previous: number };
  /** Bookings paid (deposit) in the last 7 days vs the 7 before: count and value. */
  bookings7d: { count: number; value: number; previousCount: number };
  /** Seats sold / capacity of open departures in the next 30 days. */
  fill30d: { sold: number; capacity: number };
  /** Money received per Vietnam day, last 30 days (oldest first, zero days included). */
  daily: { day: string; vnd: number }[];
  /** Paid bookings in the last 30 days per tour. */
  byTour: { tourSlug: string; count: number; vnd: number }[];
  queue: { attention: number; transfers: number; toConfirm: number; refunds: number; expiringHolds: number; lowFill: number };
  /** Departures in the next 14 days with seats sold. */
  upcoming: { id: string; date: string; tourSlug: string; capacity: number; sold: number }[];
  /** Latest bookings (any status). */
  recent: { code: string; name: string; status: string; totalVnd: number; tourSlug: string; createdAt: Date }[];
}

/** Business overview for /admin (owner's dashboard, 2026-10-07). Read-only queries; money in VND integers. */
export function createDashboard(deps: { db: Db; now?: () => Date }) {
  const { db } = deps;
  const now = () => deps.now?.() ?? new Date();

  async function collectedBetween(from: Date, to: Date): Promise<number> {
    const [row] = await db
      .select({
        deposits: sql<number>`coalesce(sum(${bookings.depositVnd}) filter (where ${bookings.depositPaidAt} >= ${from.toISOString()} and ${bookings.depositPaidAt} < ${to.toISOString()}), 0)::bigint`,
        balances: sql<number>`coalesce(sum(${bookings.totalVnd} - ${bookings.depositVnd}) filter (where ${bookings.balancePaidAt} >= ${from.toISOString()} and ${bookings.balancePaidAt} < ${to.toISOString()}), 0)::bigint`,
      })
      .from(bookings);
    return Number(row?.deposits ?? 0) + Number(row?.balances ?? 0);
  }

  return {
    async data(): Promise<DashboardData> {
      const at = now();
      const today = vietnamToday(at);
      const monthStart = vietnamDayStart(`${today.slice(0, 8)}01`);
      const prevMonthDay = `${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8)}01`;
      const prevMonthStart = vietnamDayStart(prevMonthDay);
      const prevSameMoment = new Date(Math.min(prevMonthStart.getTime() + (at.getTime() - monthStart.getTime()), monthStart.getTime()));
      const since30 = vietnamDayStart(addDays(today, -29));

      const [month, previous] = await Promise.all([collectedBetween(monthStart, at), collectedBetween(prevMonthStart, prevSameMoment)]);

      const [week] = await db
        .select({
          count: sql<number>`count(*) filter (where ${bookings.depositPaidAt} >= ${new Date(at.getTime() - 7 * DAY).toISOString()})::int`,
          value: sql<number>`coalesce(sum(${bookings.totalVnd}) filter (where ${bookings.depositPaidAt} >= ${new Date(at.getTime() - 7 * DAY).toISOString()}), 0)::bigint`,
          previousCount: sql<number>`count(*) filter (where ${bookings.depositPaidAt} < ${new Date(at.getTime() - 7 * DAY).toISOString()})::int`,
        })
        .from(bookings)
        .where(and(inArray(bookings.status, SOLD_STATUSES), gte(bookings.depositPaidAt, new Date(at.getTime() - 14 * DAY))));

      // Qualified on purpose: in a select list Drizzle may print a bare "id", which inside this subquery means b.id.
      const soldSeats = sql<number>`coalesce((select sum(b.seats) from ${bookings} b where b.departure_id = ${sql.raw(`"departures"."id"`)} and b.status in (${sql.join(SOLD_STATUSES.map((s) => sql`${s}`), sql`, `)})), 0)::int`;
      const [fill] = await db
        .select({ capacity: sql<number>`coalesce(sum(${departures.capacity}), 0)::int`, sold: sql<number>`coalesce(sum(${soldSeats}), 0)::int` })
        .from(departures)
        .where(and(eq(departures.status, "open"), gte(departures.date, today), lte(departures.date, addDays(today, 30))));

      // A literal time zone (not a bind parameter): GROUP BY must see the same expression as SELECT.
      const paidDay = (col: typeof bookings.depositPaidAt | typeof bookings.balancePaidAt) => sql<string>`to_char(${col} at time zone ${sql.raw(`'${TZ}'`)}, 'YYYY-MM-DD')`;
      const [depositDays, balanceDays] = await Promise.all([
        db
          .select({ day: paidDay(bookings.depositPaidAt), vnd: sql<number>`sum(${bookings.depositVnd})::bigint` })
          .from(bookings)
          .where(gte(bookings.depositPaidAt, since30))
          .groupBy(paidDay(bookings.depositPaidAt)),
        db
          .select({ day: paidDay(bookings.balancePaidAt), vnd: sql<number>`sum(${bookings.totalVnd} - ${bookings.depositVnd})::bigint` })
          .from(bookings)
          .where(gte(bookings.balancePaidAt, since30))
          .groupBy(paidDay(bookings.balancePaidAt)),
      ]);
      const perDay = new Map<string, number>();
      for (const r of [...depositDays, ...balanceDays]) perDay.set(r.day, (perDay.get(r.day) ?? 0) + Number(r.vnd));
      const daily = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((day) => ({ day, vnd: perDay.get(day) ?? 0 }));

      const byTour = await db
        .select({ tourSlug: departures.tourSlug, count: count(), vnd: sql<number>`sum(${bookings.totalVnd})::bigint` })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(and(inArray(bookings.status, SOLD_STATUSES), gte(bookings.depositPaidAt, since30)))
        .groupBy(departures.tourSlug)
        .orderBy(desc(sql`sum(${bookings.totalVnd})`));

      const pendingTransfer = sql`exists (select 1 from ${bookingPayments} p where p.booking_id = ${bookings.id} and p.method = 'transfer' and p.status = 'pending')`;
      const [queue] = await db
        .select({
          attention: sql<number>`count(*) filter (where ${needsAttention()})::int`,
          transfers: sql<number>`count(*) filter (where ${inArray(bookings.status, canBecome("deposit_paid"))} and ${pendingTransfer})::int`,
          toConfirm: sql<number>`count(*) filter (where ${inArray(bookings.status, canBecome("confirmed"))})::int`,
          refunds: sql<number>`count(*) filter (where ${bookings.refundDueVnd} > 0 and ${isNull(bookings.refundedAt)})::int`,
          expiringHolds: sql<number>`count(*) filter (where ${eq(bookings.status, "held")} and ${gt(bookings.holdExpiresAt, at)} and ${lt(bookings.holdExpiresAt, new Date(at.getTime() + 2 * 3_600_000))})::int`,
        })
        .from(bookings);

      const upcomingRows = await db
        .select({ id: departures.id, date: departures.date, tourSlug: departures.tourSlug, capacity: departures.capacity, sold: soldSeats })
        .from(departures)
        .where(and(eq(departures.status, "open"), gte(departures.date, today), lte(departures.date, addDays(today, 14))))
        .orderBy(asc(departures.date), asc(departures.tourSlug));
      const upcoming = upcomingRows.filter((d) => d.sold > 0);
      const lowFill = upcomingRows.filter((d) => d.date <= addDays(today, 7) && d.sold > 0 && d.sold / d.capacity < 0.5).length;

      const recent = await db
        .select({ code: bookings.code, name: bookings.name, status: bookings.status, totalVnd: bookings.totalVnd, tourSlug: departures.tourSlug, createdAt: bookings.createdAt })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .orderBy(desc(bookings.createdAt))
        .limit(6);

      return {
        collected: { month, previous },
        bookings7d: { count: week?.count ?? 0, value: Number(week?.value ?? 0), previousCount: week?.previousCount ?? 0 },
        fill30d: { sold: fill?.sold ?? 0, capacity: fill?.capacity ?? 0 },
        daily,
        byTour: byTour.map((r) => ({ tourSlug: r.tourSlug, count: r.count, vnd: Number(r.vnd) })),
        queue: { attention: queue?.attention ?? 0, transfers: queue?.transfers ?? 0, toConfirm: queue?.toConfirm ?? 0, refunds: queue?.refunds ?? 0, expiringHolds: queue?.expiringHolds ?? 0, lowFill },
        upcoming,
        recent,
      };
    },
  };
}

export type Dashboard = ReturnType<typeof createDashboard>;
