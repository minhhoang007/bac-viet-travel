import { and, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { bookings } from "../schema/booking";
import { SOLD_STATUSES } from "./lifecycle";

export { awaitsDeposit, canBecome, canMove, isSold, LIFECYCLE, SOLD_STATUSES } from "./lifecycle";

/** A booking that takes seats at `at`: sold, or held and the hold has not expired. */
export function takesSeats(at: Date): SQL {
  return or(inArray(bookings.status, SOLD_STATUSES), and(eq(bookings.status, "held"), gt(bookings.holdExpiresAt, at)))!;
}

/**
 * takesSeats for a correlated subquery over `bookings b`. Written out by hand: inside a correlated subquery Drizzle
 * renders bare column names, which would resolve to the outer table.
 */
export function takesSeatsB(at: Date): SQL {
  const sold = sql.join(SOLD_STATUSES.map((s) => sql`${s}`), sql`, `);
  return sql`(b.status in (${sold}) or (b.status = 'held' and b.hold_expires_at > ${at.toISOString()}))`;
}
