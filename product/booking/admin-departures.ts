import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { ProductContext } from "@/core/product/context";
import type { Db } from "@/db/client";
import { bookings, departures, type Booking, type BookingStatus, type Departure } from "../schema/booking";
import { addDays, travellerKinds, vietnamToday } from "./rules";
import { SOLD_STATUSES, takesSeats } from "./status";

type Actor = Parameters<NonNullable<ProductContext["audit"]>["audited"]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface AdminDepartureRow extends Departure {
  /** Seats in paid/confirmed bookings. */
  sold: number;
  /** Seats in live holds. */
  held: number;
}

/**
 * One person on a departure. Bookings whose guest has not filled the traveller list give one row for the lead guest
 * with `missing` = how many people are not named yet.
 */
export interface PassengerRow {
  code: string;
  name: string;
  birthYear: number | null;
  kind: "adult" | "child" | "infant" | null;
  contact: string;
  phone: string;
  note: string;
  status: BookingStatus;
  missing: number;
}

/** Rows of one booking, travellers in party order (adults, children, infants). */
function passengerRows(b: Booking): PassengerRow[] {
  const base = { code: b.code, contact: b.name, phone: b.phone, note: b.note, status: b.status };
  const people = b.adults + b.children + b.infants;
  if (b.travellers.length === 0) return [{ ...base, name: b.name, birthYear: null, kind: null, missing: people }];
  const kinds = travellerKinds(b);
  return b.travellers.map((p, i) => ({ ...base, name: p.name, birthYear: p.birthYear, kind: kinds[i] ?? null, missing: 0 }));
}

/** Departures in the admin (part of BookingAdmin): seats per date, the passenger list, adding and editing dates. */
export interface DepartureAdmin {
  listDepartures(options: { tourSlug?: string; from: string; to: string }): Promise<AdminDepartureRow[]>;
  /** Passenger list of one departure (H1): paid and confirmed bookings, one row per traveller, for the guide. */
  passengers(departureId: string): Promise<{ departure: Departure; rows: PassengerRow[] } | null>;
  addDepartures(actor: Actor, input: { tourSlug: string; dates: string[]; capacity: number; priceVnd: number | null }): Promise<number>;
  updateDeparture(actor: Actor, id: string, input: { capacity?: number; priceVnd?: number | null; status?: Departure["status"] }): Promise<boolean>;
}

export function createDepartureAdmin(deps: {
  db: Db;
  /** BookingAdmin's audit wrapper. */
  audited: (actor: Actor, action: string, targetId: string, metadata: Record<string, unknown>, work: () => Promise<boolean>) => Promise<boolean>;
  tourExists: (slug: string) => Promise<boolean>;
  now: () => Date;
}): DepartureAdmin {
  const { db, audited, now } = deps;

  const seatCounts = (at: Date) => ({
    sold: sql<number>`coalesce((select sum(b.seats) from bookings b where b.departure_id = departures.id and b.status in ('deposit_paid', 'confirmed')), 0)::int`,
    held: sql<number>`coalesce((select sum(b.seats) from bookings b where b.departure_id = departures.id and b.status = 'held' and b.hold_expires_at > ${at.toISOString()}), 0)::int`,
  });

  return {
    async passengers(departureId) {
      if (!UUID.test(departureId)) return null;
      const [departure] = await db.select().from(departures).where(eq(departures.id, departureId));
      if (!departure) return null;
      const rows = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.departureId, departureId), inArray(bookings.status, [...SOLD_STATUSES])))
        .orderBy(asc(bookings.createdAt));
      return { departure, rows: rows.flatMap(passengerRows) };
    },

    async listDepartures({ tourSlug, from, to }) {
      // Private departures belong to one booking each: they are managed from the booking, not here.
      const where = [gte(departures.date, from), lte(departures.date, to), eq(departures.kind, "group")];
      if (tourSlug) where.push(eq(departures.tourSlug, tourSlug));
      const rows = await db
        .select({ d: departures, ...seatCounts(now()) })
        .from(departures)
        .where(and(...where))
        .orderBy(asc(departures.date), asc(departures.tourSlug));
      return rows.map((r) => ({ ...r.d, sold: r.sold, held: r.held }));
    },

    async addDepartures(actor, { tourSlug, dates, capacity, priceVnd }) {
      if (!(await deps.tourExists(tourSlug))) throw new AppError("VALIDATION_ERROR", "Unknown tour");
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new AppError("VALIDATION_ERROR", "Invalid capacity");
      if (priceVnd !== null && (!Number.isInteger(priceVnd) || priceVnd < 10_000 || priceVnd > 100_000_000)) throw new AppError("VALIDATION_ERROR", "Invalid price");
      const today = vietnamToday(now());
      const valid = [...new Set(dates)].filter((d) => DAY.test(d) && d >= today && d <= addDays(today, 730)).slice(0, 120);
      if (valid.length === 0) throw new AppError("VALIDATION_ERROR", "No valid dates");
      let added = 0;
      await audited(actor, "departure.add", tourSlug, { dates: valid, capacity, priceVnd }, async () => {
        const rows = await db
          .insert(departures)
          .values(valid.map((date) => ({ tourSlug, date, capacity, priceVnd })))
          .onConflictDoNothing()
          .returning({ id: departures.id });
        added = rows.length;
        return added > 0;
      });
      return added;
    },

    async updateDeparture(actor, id, input) {
      if (!UUID.test(id)) throw new AppError("NOT_FOUND");
      if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100)) throw new AppError("VALIDATION_ERROR", "Invalid capacity");
      if (input.priceVnd != null && (!Number.isInteger(input.priceVnd) || input.priceVnd < 10_000 || input.priceVnd > 100_000_000)) throw new AppError("VALIDATION_ERROR", "Invalid price");
      return audited(actor, "departure.update", id, input, () =>
        db.transaction(async (tx) => {
          // Same lock as holds: no seat can be sold between the check and the update.
          const [d] = await tx.select().from(departures).where(eq(departures.id, id)).for("update");
          if (!d) throw new AppError("NOT_FOUND");
          if (input.capacity !== undefined) {
            const [row] = await tx
              .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
              .from(bookings)
              .where(and(eq(bookings.departureId, id), takesSeats(now())));
            if (input.capacity < (row?.taken ?? 0)) throw new AppError("VALIDATION_ERROR", "Capacity below seats taken", { details: { taken: row?.taken } });
          }
          const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
          if (Object.keys(set).length === 0) return false;
          await tx.update(departures).set(set).where(eq(departures.id, id));
          return true;
        }),
      );
    },
  };
}
