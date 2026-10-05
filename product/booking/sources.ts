/** Where a booking came from: the website, or entered by staff (phone, Zalo, an OTA such as Klook). No DB imports: UI uses it. */
export const MANUAL_SOURCES = ["phone", "zalo", "klook", "viator", "getyourguide", "other"] as const;
export const BOOKING_SOURCES = ["website", ...MANUAL_SOURCES] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];
