import { z } from "zod";

// Tour types and schemas without Node APIs: safe to import from client components (admin form).

export const DESTINATIONS = ["ha-long", "ninh-binh", "sapa"] as const;
export type Destination = (typeof DESTINATIONS)[number];
export const isDestination = (slug: string): slug is Destination => (DESTINATIONS as readonly string[]).includes(slug);

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
  /** Display order inside a destination (lower first). */
  order: z.number().int().default(100),
  /** Private tour (own vehicle, guide and date): price per person by group size. Absent = group tours only. */
  private: privateTourSchema.optional(),
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
