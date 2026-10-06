import { z } from "zod";

// Tour types and schemas without Node APIs: safe to import from client components (admin form).

import { DESTINATIONS } from "./destinations";
export { DESTINATIONS, isDestination, type Destination } from "./destinations";

/**
 * Prices by traveller type (B2). Absent = the defaults: children 75% of the adult price, infants free, no single
 * room supplement. The supplement (per single room, whole tour) only makes sense for tours with nights.
 */
export const tourPricingSchema = z.object({
  childPercent: z.number().int().min(0).max(100).default(75),
  infantVnd: z.number().int().min(0).max(100_000_000).default(0),
  singleSupplementVnd: z.number().int().min(0).max(100_000_000).default(0),
});
export type TourPricing = z.infer<typeof tourPricingSchema>;

/**
 * An optional extra the guest can add to a booking (B6): hotel pick-up, vegetarian meals, motorbike rental…
 * per: "person" = up to one per traveller, "booking" = once. id stays the same when the name or price changes.
 */
export const addonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,30}$/),
  name: z.object({ vi: z.string().trim().min(1).max(80), en: z.string().trim().min(1).max(80) }),
  vnd: z.number().int().min(0).max(100_000_000),
  per: z.enum(["person", "booking"]),
});
export type Addon = z.infer<typeof addonSchema>;

/** Activity levels of a tour (B7). */
export const ACTIVITY_LEVELS = ["easy", "moderate", "challenging"] as const;

/** Private tour (own vehicle, guide and date): price per person by group size. */
export const privateTourSchema = z
  .object({
    tiers: z
      .array(z.object({ minGuests: z.number().int().min(1), vnd: z.number().int().positive(), usd: z.number().positive() }))
      .min(1)
      .refine((t) => t.every((x, i) => i === 0 || x.minGuests > t[i - 1]!.minGuests), "tiers must be sorted by minGuests"),
    maxGuests: z.number().int().min(1).max(50),
  });

/** Tour files: content/tours/<locale>/<slug>.mdx. The same slug in every locale = the same tour (shared URL). */
export const tourSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(300),
  destination: z.enum(DESTINATIONS),
  days: z.number().int().min(1).max(30),
  nights: z.number().int().min(0).max(30),
  price: z.object({ vnd: z.number().int().positive(), usd: z.number().positive() }),
  /** Paths under public/ — the first one is the cover. */
  images: z.array(z.string().startsWith("/")).min(1),
  departure: z.string().min(1),
  groupSize: z.string().min(1),
  highlights: z.array(z.string().min(1)).min(1),
  itinerary: z.array(z.object({ title: z.string().min(1), description: z.string().min(1) })).min(1),
  includes: z.array(z.string().min(1)).min(1),
  excludes: z.array(z.string().min(1)).default([]),
  featured: z.boolean().default(false),
  /** How physical the tour is (B7); absent = not shown. */
  activity: z.enum(ACTIVITY_LEVELS).optional(),
  /** Pick-up time, e.g. "7:30–8:00 tại khách sạn phố cổ" (B7). */
  pickupTime: z.string().max(100).default(""),
  /** What to bring (B7). */
  bring: z.array(z.string().min(1)).default([]),
  /** Display order inside a destination (lower first). */
  order: z.number().int().default(100),
  /** Private tour (own vehicle, guide and date): price per person by group size. Absent = group tours only. */
  private: privateTourSchema.optional(),
  pricing: tourPricingSchema.optional(),
  addons: z.array(addonSchema).max(10).default([]),
});

export type TourData = z.infer<typeof tourSchema>;
export interface Tour extends TourData {
  slug: string;
  locale: string;
  /** MDX overview (body after the frontmatter). */
  body: string;
  /** Google title and description when they differ from the title and summary (CMS tours). */
  seoTitle?: string;
  seoDescription?: string;
}
