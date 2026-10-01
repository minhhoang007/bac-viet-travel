import { z } from "zod";
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
    locale: z.enum(["vi", "en"]).catch("vi"),
  })
  .refine((v) => v.adults + v.children <= bookingRules.maxSeatsPerBooking, { path: ["children"], message: "too_many" });

export type BookingInput = z.infer<typeof bookingInputSchema>;
