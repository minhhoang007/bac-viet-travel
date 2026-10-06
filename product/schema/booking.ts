import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { BOOKING_SOURCES } from "../booking/sources";

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
    /** group: shared seats, listed for guests. private: created by one private booking (capacity = its seats), never listed. */
    kind: text("kind", { enum: ["group", "private"] }).notNull().default("group"),
    ...timestamps(),
  },
  (t) => [
    // One group departure per tour and day; private departures may share the day.
    uniqueIndex("departures_tour_date_idx").on(t.tourSlug, t.date).where(sql`${t.kind} = 'group'`),
    check("departures_capacity_check", sql`${t.capacity} > 0`),
  ],
);

/** An add-on on a booking: quantity and line price at booking time. */
export type BookedAddon = { id: string; name: { vi: string; en: string }; qty: number; vnd: number };

/** One person on the trip, in party order: adults, then children, then infants. */
export type Traveller = { name: string; birthYear: number };

/** refund_due: a deposit arrived after the hold expired and the seats were gone (staff refunds it). */
export const BOOKING_STATUSES = ["held", "expired", "deposit_paid", "refund_due", "confirmed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export { BOOKING_SOURCES, MANUAL_SOURCES, type BookingSource } from "../booking/sources";

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
    /** Names and birth years of everyone on the trip (D7), filled in by the guest after booking (insurance, cruise lists). */
    travellers: jsonb("travellers").$type<Traveller[]>().notNull().default([]),
    /** Discount code used (D6), upper case; null = none. */
    discountCode: text("discount_code"),
    /** Amount taken off the total by the code (VND). */
    discountVnd: integer("discount_vnd").notNull().default(0),
    /** Add-ons chosen (B6), as priced when booking (names in both languages). */
    addons: jsonb("addons").$type<BookedAddon[]>().notNull().default([]),
    /** Single rooms booked (supplement per room, B2). */
    singleRooms: integer("single_rooms").notNull().default(0),
    /** Seats taken: adults + children (infants share a seat). */
    seats: integer("seats").notNull(),
    unitPriceVnd: integer("unit_price_vnd").notNull(),
    totalVnd: integer("total_vnd").notNull(),
    depositVnd: integer("deposit_vnd").notNull(),
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),
    /** When the rest of the total was paid (online, or recorded by staff) (D5); null = still owed. */
    balancePaidAt: timestamp("balance_paid_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    /** Money owed back to the guest (late deposit, cancellation with refund). 0 = nothing owed. */
    refundDueVnd: integer("refund_due_vnd").notNull().default(0),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundNote: text("refund_note"),
    /** Staff-only note (never shown to the guest). */
    staffNote: text("staff_note").notNull().default(""),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    /** When the post-trip feedback email was sent (E4); null = not yet. */
    feedbackRequestedAt: timestamp("feedback_requested_at", { withTimezone: true }),
    source: text("source", { enum: BOOKING_SOURCES }).notNull().default("website"),
    /** The OTA's own booking reference (e.g. Klook order number), for staff-entered bookings. */
    externalRef: text("external_ref"),
    /** false: send the guest no emails (the OTA already sends its own voucher and messages). */
    guestEmails: boolean("guest_emails").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("bookings_code_idx").on(t.code),
    index("bookings_departure_status_idx").on(t.departureId, t.status),
    check("bookings_seats_check", sql`${t.seats} > 0`),
  ],
);

export const PAYMENT_STATUSES = ["pending", "paid", "failed"] as const;
/** vnpay: online payment (IPN). transfer: bank transfer by VietQR, confirmed by staff. */
export const PAYMENT_METHODS = ["vnpay", "transfer"] as const;

/** One deposit attempt for a booking (VNPay, or a bank transfer the guest chose). A guest may retry after a failure. */
export const bookingPayments = pgTable(
  "booking_payments",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("vnpay"),
    /** deposit: the hold's deposit. balance: the rest of the total, paid online before departure (D5). */
    purpose: text("purpose", { enum: ["deposit", "balance"] }).notNull().default("deposit"),
    /** vnp_TxnRef we send (unique per attempt); for a transfer, the booking code without "BV-" plus "CK". */
    txnRef: text("txn_ref").notNull(),
    amountVnd: integer("amount_vnd").notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    /** VNPay transaction number and response code from the IPN; for a transfer, the bank reference staff entered. */
    providerTxnNo: text("provider_txn_no"),
    responseCode: text("response_code"),
    bankCode: text("bank_code"),
    /** Guest link token, kept only until the IPN emails the link (then erased). */
    linkToken: text("link_token"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("booking_payments_txn_ref_idx").on(t.txnRef), index("booking_payments_booking_idx").on(t.bookingId)],
);

export type BookingPayment = typeof bookingPayments.$inferSelect;
export type Departure = typeof departures.$inferSelect;
export type Booking = typeof bookings.$inferSelect;

/**
 * Discount codes (D6): percent or fixed VND off the total, valid between two days (Vietnam time), optionally for one
 * tour, a minimum total, and a maximum number of live bookings (held, paid, confirmed).
 */
export const discountCodes = pgTable(
  "discount_codes",
  {
    id: id(),
    /** Upper case letters, digits and dashes, e.g. TET2027. */
    code: text("code").notNull(),
    kind: text("kind", { enum: ["percent", "amount"] }).notNull(),
    /** Percent (1–90) or VND. */
    value: integer("value").notNull(),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    validTo: date("valid_to", { mode: "string" }).notNull(),
    /** Only for this tour; null = every tour. */
    tourSlug: text("tour_slug"),
    minTotalVnd: integer("min_total_vnd").notNull().default(0),
    /** null = unlimited. */
    maxUses: integer("max_uses"),
    active: boolean("active").notNull().default(true),
    note: text("note").notNull().default(""),
    ...timestamps(),
  },
  (t) => [uniqueIndex("discount_codes_code_idx").on(t.code), check("discount_codes_value_check", sql`${t.value} > 0`)],
);
export type DiscountCode = typeof discountCodes.$inferSelect;

/** Post-trip feedback (E4): one per booking, from the signed link in the feedback email. Staff only. */
export const tripFeedback = pgTable(
  "trip_feedback",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps(),
  },
  (t) => [uniqueIndex("trip_feedback_booking_idx").on(t.bookingId), check("trip_feedback_rating_check", sql`${t.rating} between 1 and 5`)],
);
export type TripFeedback = typeof tripFeedback.$inferSelect;
