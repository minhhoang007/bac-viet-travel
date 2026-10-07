import { z } from "zod";
import { MANUAL_SOURCES } from "./sources";
import { bookingRules } from "./rules";

/** Discount code typed by the guest: trimmed, upper case; empty = none. */
export const discountCodeField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.union([z.literal(""), z.string().regex(/^[A-Z0-9-]{3,30}$/, "invalid")]))
  .default("");

const count = (min: number, max: number) => z.coerce.number({ message: "invalid" }).int("invalid").min(min, "invalid").max(max, "invalid");

/** Guest booking form. Error messages are codes; the UI maps them to localized text. */
export const bookingInputSchema = z
  .object({
    departureId: z.uuid("invalid"),
    name: z.string().trim().min(2, "required").max(100, "too_long"),
    email: z.email("invalid").max(200, "too_long"),
    phone: z.string().trim().regex(/^\+?[0-9 ().-]{8,20}$/, "invalid"),
    adults: count(1, bookingRules.maxSeatsPerBooking),
    children: count(0, bookingRules.maxSeatsPerBooking).default(0),
    infants: count(0, bookingRules.maxInfants).default(0),
    /** Single rooms (supplement), only on tours that set one; at most one per traveller. */
    singleRooms: count(0, bookingRules.maxSeatsPerBooking).default(0),
    discountCode: discountCodeField,
    note: z.string().trim().max(1000, "too_long").default(""),
    /** Checkbox "I accept the terms and the cancellation policy" (browsers post "on"). */
    agree: z.literal("on", { message: "must_agree" }),
    locale: z.enum(["vi", "en"]).catch("vi"),
  })
  .refine((v) => v.adults + v.children <= bookingRules.maxSeatsPerBooking, { path: ["children"], message: "too_many" })
  .refine((v) => v.singleRooms <= v.adults + v.children, { path: ["singleRooms"], message: "too_many" });

export type BookingInput = z.infer<typeof bookingInputSchema>;

/** Private tour: the guest picks the date; seat limits come from the tour's private pricing (checked in the service). */
export const privateBookingInputSchema = z
  .object({
    tourSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid"),
    name: z.string().trim().min(2, "required").max(100, "too_long"),
    email: z.email("invalid").max(200, "too_long"),
    phone: z.string().trim().regex(/^\+?[0-9 ().-]{8,20}$/, "invalid"),
    adults: count(1, 50),
    children: count(0, 50).default(0),
    infants: count(0, bookingRules.maxInfants).default(0),
    singleRooms: count(0, 50).default(0),
    discountCode: discountCodeField,
    note: z.string().trim().max(1000, "too_long").default(""),
    locale: z.enum(["vi", "en"]).catch("vi"),
    agree: z.literal("on", { message: "must_agree" }),
  })
  .refine((v) => v.singleRooms <= v.adults + v.children, { path: ["singleRooms"], message: "too_many" });

export type PrivateBookingInput = z.infer<typeof privateBookingInputSchema>;

/** Staff fixing the guest's contact details. Email may be empty only when the booking sends no guest emails. */
export const contactUpdateSchema = z.object({
  name: z.string().trim().min(2, "required").max(100, "too_long"),
  email: z.union([z.literal(""), z.email("invalid").max(200, "too_long")]).default(""),
  phone: z.string().trim().max(30, "too_long").default(""),
});

/**
 * Staff-entered booking (phone, Zalo, OTA). Paid outside the website, so it is created directly as deposit_paid or
 * confirmed. Email is optional (OTAs often hide it); amountVnd is what the company actually receives.
 */
export const manualBookingSchema = z
  .object({
    departureId: z.uuid("invalid"),
    name: z.string().trim().min(2, "required").max(100, "too_long"),
    email: z.union([z.literal(""), z.email("invalid").max(200, "too_long")]).default(""),
    phone: z.string().trim().max(30, "too_long").default(""),
    adults: count(1, 50),
    children: count(0, 50).default(0),
    infants: count(0, 20).default(0),
    note: z.string().trim().max(1000, "too_long").default(""),
    source: z.enum(MANUAL_SOURCES, { message: "invalid" }),
    externalRef: z.string().trim().max(100, "too_long").default(""),
    amountVnd: z.coerce.number({ message: "invalid" }).int("invalid").min(0, "invalid").max(1_000_000_000, "invalid"),
    status: z.enum(["deposit_paid", "confirmed"], { message: "invalid" }),
    guestEmails: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    locale: z.enum(["vi", "en"]).catch("vi"),
  })
  .refine((v) => !v.guestEmails || v.email !== "", { path: ["email"], message: "required" });

export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

/**
 * Traveller list from the guest booking page: one row per person (name_i, year_i). Every row is required; birth
 * years between 1900 and this year. Errors are per row index ("name_2": "required").
 */
export function parseTravellers(raw: Record<string, unknown>, count: number, currentYear: number): { ok: true; travellers: { name: string; birthYear: number }[] } | { ok: false; errors: Record<string, "required" | "invalid" | "too_long"> } {
  const errors: Record<string, "required" | "invalid" | "too_long"> = {};
  const travellers: { name: string; birthYear: number }[] = [];
  for (let i = 0; i < count; i++) {
    const name = String(raw[`name_${i}`] ?? "").trim().replace(/\s+/g, " ");
    const yearText = String(raw[`year_${i}`] ?? "").trim();
    const year = Number(yearText);
    if (name.length < 2) errors[`name_${i}`] = "required";
    else if (name.length > 100) errors[`name_${i}`] = "too_long";
    if (!yearText) errors[`year_${i}`] = "required";
    else if (!/^\d{4}$/.test(yearText) || year < 1900 || year > currentYear) errors[`year_${i}`] = "invalid";
    travellers.push({ name, birthYear: year });
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, travellers };
}
