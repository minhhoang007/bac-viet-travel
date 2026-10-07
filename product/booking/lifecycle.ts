// Pure (no database code): pages and client components may import it.
import type { BookingStatus } from "../schema/booking";

/**
 * The booking lifecycle, in one place. `sold`: the booking has paid for its seats. `next`: the statuses it may move
 * to. A new status does not compile until it is described here, and every status change in the services goes
 * through canBecome(), so a move the table does not allow never matches a row.
 *
 *   held ──deposit──▶ deposit_paid ──staff──▶ confirmed
 *    │  ╲                  │                     │
 *    │   ╲ late, no seats  └──────cancelled◀─────┘
 *    ▼    ▼
 *  expired ──deposit──▶ deposit_paid / refund_due
 */
export const LIFECYCLE = {
  held: { sold: false, next: ["deposit_paid", "refund_due", "expired", "cancelled"] },
  expired: { sold: false, next: ["deposit_paid", "refund_due"] },
  deposit_paid: { sold: true, next: ["confirmed", "cancelled"] },
  confirmed: { sold: true, next: ["cancelled"] },
  refund_due: { sold: false, next: [] },
  cancelled: { sold: false, next: [] },
} as const satisfies Record<BookingStatus, { sold: boolean; next: readonly BookingStatus[] }>;

const STATUSES = Object.keys(LIFECYCLE) as BookingStatus[];

export function canMove(from: BookingStatus, to: BookingStatus): boolean {
  return (LIFECYCLE[from].next as readonly BookingStatus[]).includes(to);
}

/** Statuses a booking may be in to move to `to` (for the WHERE of a status update). */
export function canBecome(to: BookingStatus): BookingStatus[] {
  return STATUSES.filter((from) => canMove(from, to));
}

/** Bookings that count as sold: deposit paid, or confirmed by staff. */
export const SOLD_STATUSES = STATUSES.filter((s) => LIFECYCLE[s].sold);

export function isSold(status: BookingStatus): boolean {
  return LIFECYCLE[status].sold;
}

/** Still waiting for its deposit: a deposit that arrives now is taken (seats permitting). */
export function awaitsDeposit(status: BookingStatus): boolean {
  return canMove(status, "deposit_paid");
}
