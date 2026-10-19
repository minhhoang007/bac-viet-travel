// The one definition of the sales figures staff see on several pages (/admin overview, /admin/bookings), so the same
// label never shows two numbers. Periods are Vietnam calendar days: "7 days" = today and the 6 days before.
import { and, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookings } from "../schema/booking";
import { addDays, vietnamDayStart } from "./rules";
import { depositInVnd, SOLD_STATUSES } from "./status";

export interface PaidBookings {
  /** Bookings whose deposit came in today and that still stand (deposit paid or confirmed; cancelled ones drop out). */
  today: number;
  /** Same, over the last 7 Vietnam days (today included). */
  week: number;
  /** Same, over the 7 days before that: for the trend. */
  previousWeek: number;
  /** Total price of this week's paid bookings (what was sold, not what was collected). */
  weekValueVnd: number;
  /** Deposit money that came in over the 7 days, cancelled bookings included: cash received (refunds are separate). */
  weekDepositsVnd: number;
}

export async function paidBookings(db: Db, today: string, now: Date): Promise<PaidBookings> {
  const dayStart = vietnamDayStart(today);
  const weekStart = vietnamDayStart(addDays(today, -6));
  const previousStart = vietnamDayStart(addDays(today, -13));
  const iso = (d: Date) => d.toISOString();
  const sold = sql`${bookings.status} in (${sql.join(SOLD_STATUSES.map((s) => sql`${s}`), sql`, `)})`;
  const inWeek = sql`${bookings.depositPaidAt} >= ${iso(weekStart)}`;
  const [row] = await db
    .select({
      today: sql<number>`count(*) filter (where ${sold} and ${bookings.depositPaidAt} >= ${iso(dayStart)})::int`,
      week: sql<number>`count(*) filter (where ${sold} and ${inWeek})::int`,
      previousWeek: sql<number>`count(*) filter (where ${sold} and ${bookings.depositPaidAt} < ${iso(weekStart)})::int`,
      weekValue: sql<number>`coalesce(sum(${bookings.totalVnd}) filter (where ${sold} and ${inWeek}), 0)::bigint`,
      weekDeposits: sql<number>`coalesce(sum(${depositInVnd()}) filter (where ${inWeek}), 0)::bigint`,
    })
    .from(bookings)
    .where(and(gte(bookings.depositPaidAt, previousStart), lte(bookings.depositPaidAt, now)));
  return {
    today: row?.today ?? 0,
    week: row?.week ?? 0,
    previousWeek: row?.previousWeek ?? 0,
    weekValueVnd: Number(row?.weekValue ?? 0),
    weekDepositsVnd: Number(row?.weekDeposits ?? 0),
  };
}
