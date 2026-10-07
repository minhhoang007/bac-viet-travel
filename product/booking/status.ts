import { and, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { bookings, type BookingStatus } from "../schema/booking";

/** Bookings that count as sold: deposit paid, or confirmed by staff. */
export const SOLD_STATUSES = ["deposit_paid", "confirmed"] as const satisfies readonly BookingStatus[];

export function isSold(status: BookingStatus): boolean {
  return (SOLD_STATUSES as readonly BookingStatus[]).includes(status);
}

/** A booking that takes seats at `at`: sold, or held and the hold has not expired. */
export function takesSeats(at: Date): SQL {
  return or(inArray(bookings.status, [...SOLD_STATUSES]), and(eq(bookings.status, "held"), gt(bookings.holdExpiresAt, at)))!;
}

/**
 * takesSeats for a correlated subquery over `bookings b`. Written out by hand: inside a correlated subquery Drizzle
 * renders bare column names, which would resolve to the outer table.
 */
export function takesSeatsB(at: Date): SQL {
  return sql`(b.status in ('deposit_paid', 'confirmed') or (b.status = 'held' and b.hold_expires_at > ${at.toISOString()}))`;
}
