import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";

/** One scheduled departure of a tour (tour = slug of content/tours/<locale>/<slug>.mdx). */
export const departures = pgTable(
  "departures",
  {
    id: id(),
    tourSlug: text("tour_slug").notNull(),
    /** Departure day in Vietnam time (YYYY-MM-DD). */
    date: date("date", { mode: "string" }).notNull(),
    capacity: integer("capacity").notNull(),
    /** Adult price for this departure; null = the tour's list price. */
    priceVnd: integer("price_vnd"),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("departures_tour_date_idx").on(t.tourSlug, t.date),
    check("departures_capacity_check", sql`${t.capacity} > 0`),
  ],
);

export const BOOKING_STATUSES = ["held", "expired", "deposit_paid", "confirmed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    /** Public reference shown to the guest, e.g. BV-7K3Q9X. */
    code: text("code").notNull(),
    /** sha256 of the secret lookup token sent to the guest (the token itself is never stored). */
    tokenHash: text("token_hash").notNull(),
    departureId: uuid("departure_id").notNull().references(() => departures.id, { onDelete: "restrict" }),
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("held"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    note: text("note").notNull().default(""),
    locale: text("locale").notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),
    /** Seats taken: adults + children (infants share a seat). */
    seats: integer("seats").notNull(),
    unitPriceVnd: integer("unit_price_vnd").notNull(),
    totalVnd: integer("total_vnd").notNull(),
    depositVnd: integer("deposit_vnd").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("bookings_code_idx").on(t.code),
    index("bookings_departure_status_idx").on(t.departureId, t.status),
    check("bookings_seats_check", sql`${t.seats} > 0`),
  ],
);

export type Departure = typeof departures.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
