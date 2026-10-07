import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { bookings, departures, type Booking, type BookingStatus, type Departure } from "../schema/booking";
import { vietnamToday } from "./rules";
import { takesSeats, takesSeatsB } from "./status";

/**
 * Staff move a paid booking to another date of the same tour (guest asked, weather…). Only to a date with the same
 * price per guest, so the total, deposit and balance stay as they are: no extra charge and no refund to decide.
 * A date with another price is refused; staff cancel and re-book instead (owner rule pending for price changes).
 */
const MOVABLE = ["deposit_paid", "confirmed"] as const satisfies readonly BookingStatus[];
export const canChangeDate = (status: BookingStatus) => (MOVABLE as readonly BookingStatus[]).includes(status);

export type ChangeDateResult = { status: "done" } | { status: "not_allowed" | "unavailable" | "price_differs" } | { status: "sold_out"; seatsLeft: number };
export interface DateOption {
  id: string;
  date: string;
  seatsLeft: number;
  /** false = another price: shown but not selectable. */
  samePrice: boolean;
}

type Moved = { status: "done"; booking: Booking; from: Departure; to: Departure };

export function createDateChange(deps: { db: Db; tourPrice: (slug: string) => Promise<number | null>; now: () => Date }) {
  const { db, now } = deps;
  const priceOf = (d: Departure, list: number | null) => d.priceVnd ?? list;

  return {
    /** Open dates of the same tour from today, with seats for this party marked by price. */
    async options(booking: Booking, current: Departure): Promise<DateOption[]> {
      if (!canChangeDate(booking.status) || current.kind !== "group") return [];
      const at = now();
      const list = await deps.tourPrice(current.tourSlug);
      const rows = await db
        .select({
          d: departures,
          // Columns written out: inside a correlated subquery Drizzle renders bare names.
          taken: sql<number>`(select coalesce(sum(b.seats), 0)::int from bookings b where b.departure_id = departures.id and ${takesSeatsB(at)})`,
        })
        .from(departures)
        .where(and(eq(departures.tourSlug, current.tourSlug), eq(departures.kind, "group"), eq(departures.status, "open"), gte(departures.date, vietnamToday(at)), ne(departures.id, current.id)))
        .orderBy(asc(departures.date))
        .limit(60);
      return rows
        .map(({ d, taken }) => ({ id: d.id, date: d.date, seatsLeft: d.capacity - taken, samePrice: priceOf(d, list) === priceOf(current, list) }))
        .filter((o) => o.seatsLeft >= booking.seats);
    },

    async move(code: string, departureId: string): Promise<Moved | Exclude<ChangeDateResult, { status: "done" }>> {
      if (!z.uuid().safeParse(departureId).success) return { status: "unavailable" };
      return db.transaction(async (tx) => {
        const at = now();
        const [b] = await tx.select().from(bookings).where(eq(bookings.code, code)).for("update");
        if (!b || !canChangeDate(b.status) || b.departureId === departureId) return { status: "not_allowed" };
        // Both departures locked in id order (the same lock online holds take), so seats are never oversold and two
        // opposite moves cannot deadlock.
        const locked = await tx.select().from(departures).where(inArray(departures.id, [b.departureId, departureId])).orderBy(asc(departures.id)).for("update");
        const from = locked.find((d) => d.id === b.departureId);
        const to = locked.find((d) => d.id === departureId);
        if (!from || !to || from.kind !== "group" || to.kind !== "group" || to.tourSlug !== from.tourSlug || to.status !== "open" || to.date < vietnamToday(at)) return { status: "unavailable" };
        const list = await deps.tourPrice(from.tourSlug);
        if (priceOf(to, list) !== priceOf(from, list)) return { status: "price_differs" };
        const [row] = await tx
          .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
          .from(bookings)
          .where(and(eq(bookings.departureId, to.id), takesSeats(at)));
        const seatsLeft = to.capacity - (row?.taken ?? 0);
        if (b.seats > seatsLeft) return { status: "sold_out", seatsLeft: Math.max(0, seatsLeft) };
        // A new date gets its own reminder.
        const [moved] = await tx.update(bookings).set({ departureId: to.id, reminderSentAt: null }).where(eq(bookings.id, b.id)).returning();
        return { status: "done", booking: moved!, from, to };
      });
    },
  };
}
