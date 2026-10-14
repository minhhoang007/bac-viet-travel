import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookingLedger, bookings, type Booking, type LedgerChannel } from "../schema/booking";
import { keptVnd } from "./lifecycle";
import type { BookingSource } from "./sources";
import { isSold } from "./status";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface LedgerInput {
  bookingId: string;
  kind: "in" | "refund" | "adjust";
  amountVnd: number;
  channel: LedgerChannel;
  at: Date;
  paymentId?: string | null;
  actorId?: string | null;
  note?: string;
  /** Money in that does not count for the trip (late deposit, a second payment): all of it is owed back. */
  owedBack?: boolean;
}

export { keptVnd, owedVnd } from "./lifecycle";

/** Staff-entered money: an OTA collected it, otherwise staff did. */
export const manualChannel = (source: BookingSource): LedgerChannel => (["klook", "viator", "getyourguide"].includes(source) ? "ota" : "staff");

/**
 * The one way money is written (review wave 2): a ledger row, and the booking's receivedVnd in step, in the caller's
 * transaction (the one that changes the booking's status, which runs first). For a sold booking, money in beyond its
 * total is owed back, and reaching the total stamps it paid in full. Returns the booking after the row, or null when
 * the payment was already recorded.
 */
export async function recordMoney(tx: Tx, entry: LedgerInput): Promise<Booking | null> {
  const { owedBack = false, ...values } = entry;
  const [row] = await tx
    .insert(bookingLedger)
    .values({ ...values, note: (values.note ?? "").trim().slice(0, 500) })
    .onConflictDoNothing({ target: bookingLedger.paymentId })
    .returning({ id: bookingLedger.id });
  if (!row) return null;
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, entry.bookingId));
  if (!b) return null;
  const received = entry.kind === "refund" ? 0 : entry.amountVnd;
  const sold = isSold(b.status);
  const back = entry.kind !== "in" ? 0 : owedBack ? entry.amountVnd : sold ? Math.max(0, keptVnd(b) + entry.amountVnd - b.totalVnd) : 0;
  const paidInFull = sold && !b.balancePaidAt && keptVnd(b) + received - back >= b.totalVnd;
  const [updated] = await tx
    .update(bookings)
    .set({ receivedVnd: sql`${bookings.receivedVnd} + ${received}`, refundDueVnd: sql`${bookings.refundDueVnd} + ${back}`, ...(paidInFull ? { balancePaidAt: entry.at } : {}) })
    .where(eq(bookings.id, entry.bookingId))
    .returning();
  return updated!;
}
