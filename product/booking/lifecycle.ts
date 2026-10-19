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

/** Money still to give back (VND): owed over the booking's life minus what was refunded. */
export function refundLeft(b: { refundDueVnd: number; refundedVnd: number }): number {
  return b.refundDueVnd - b.refundedVnd;
}

type Money = { status: BookingStatus; totalVnd: number; depositVnd: number; balanceCreditVnd: number; balancePaidAt: Date | null };

/** What the guest has paid for the trip itself (deposit and any early part of the balance, or the whole total once settled); 0 while only held. */
export function paidSoFar(b: Money): number {
  if (!isSold(b.status)) return 0;
  return b.balancePaidAt ? Math.max(b.totalVnd, b.depositVnd) : b.depositVnd + b.balanceCreditVnd;
}

/** Rest of the total still to collect (D5): sold bookings whose balance is not settled yet, less what came early. */
export function balanceDue(b: Money): number {
  if (!isSold(b.status) || b.balancePaidAt) return 0;
  return Math.max(0, b.totalVnd - b.depositVnd - b.balanceCreditVnd);
}
