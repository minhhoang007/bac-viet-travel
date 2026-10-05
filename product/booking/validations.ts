import { z } from "zod";
import { MANUAL_SOURCES } from "./sources";
import { bookingRules } from "./rules";

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
    note: z.string().trim().max(1000, "too_long").default(""),
    /** Checkbox "I accept the terms and the cancellation policy" (browsers post "on"). */
    agree: z.literal("on", { message: "must_agree" }),
    locale: z.enum(["vi", "en"]).catch("vi"),
  })
  .refine((v) => v.adults + v.children <= bookingRules.maxSeatsPerBooking, { path: ["children"], message: "too_many" });

export type BookingInput = z.infer<typeof bookingInputSchema>;

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
