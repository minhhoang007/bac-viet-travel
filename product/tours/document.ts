import { z } from "zod";
import { ACTIVITY_LEVELS, addonSchema, DESTINATIONS, privateTourSchema, tourPricingSchema, type Tour } from "./model";

/**
 * A tour as stored in the content module (content type "tour", one item per tour, slug shared by every locale).
 * Facts shared by every language live in `shared`; texts per locale in `vi` / `en`. The same schema validates the
 * admin form and the data read back for the public pages.
 */

export const TOUR_LOCALES = ["vi", "en"] as const;
export type TourLocale = (typeof TOUR_LOCALES)[number];

/** A static file under public/ (current photos) or an image of the media library (Cloudinary). */
export const tourImageSchema = z.union([
  z.object({ src: z.string().regex(/^\/[\w./-]+$/, "path under public/") }),
  z.object({ mediaId: z.uuid() }),
]);
export type TourImage = z.infer<typeof tourImageSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);
const list = (max: number) => z.array(text(max)).max(30);

export const tourTextSchema = z.object({
  title: text(120),
  summary: text(300),
  departure: text(200),
  groupSize: text(100),
  highlights: list(200).min(1),
  itinerary: z.array(z.object({ title: text(200), description: text(2000) })).min(1).max(30),
  includes: list(200).min(1),
  excludes: list(200),
  /** Pick-up time and place detail (B7), e.g. "7:30–8:00, hotels in the Old Quarter". */
  pickupTime: z.string().trim().max(100).default(""),
  /** What to bring (B7). */
  bring: list(200).default([]),
  /** Overview in Markdown (MDX components such as <Callout> allowed). */
  body: z.string().max(20_000).default(""),
  /** Google title and description; empty = the tour name and summary. */
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(160).default(""),
});
export type TourText = z.infer<typeof tourTextSchema>;

export const tourSharedSchema = z
  .object({
    destination: z.enum(DESTINATIONS),
    days: z.number().int().min(1).max(30),
    nights: z.number().int().min(0).max(30),
    price: z.object({ vnd: z.number().int().positive(), usd: z.number().positive() }),
    /** The first image is the cover. */
    images: z.array(tourImageSchema).min(1).max(20),
    featured: z.boolean().default(false),
    activity: z.enum(ACTIVITY_LEVELS).optional(),
    /** Display order inside a destination (lower first). */
    order: z.number().int().min(0).max(1000).default(100),
    private: privateTourSchema.optional(),
    pricing: tourPricingSchema.optional(),
    addons: z.array(addonSchema).max(10).default([]),
  })
  .refine((s) => s.nights <= s.days, { message: "nights cannot exceed days", path: ["nights"] })
  .refine((s) => !s.pricing?.singleSupplementVnd || s.nights > 0, { message: "single supplement needs nights", path: ["pricing", "singleSupplementVnd"] });

/** Complete tour: required to submit for review and to publish. */
export const tourDocumentSchema = z.object({ shared: tourSharedSchema, vi: tourTextSchema, en: tourTextSchema });
export type TourDocument = z.infer<typeof tourDocumentSchema>;

/**
 * Work in progress: editors may save a draft with missing or half-typed fields (only the three sections are
 * checked). The admin form builds the values; `tourProblems` lists what is still missing before submitting.
 */
export const tourDraftSchema = z.object({
  shared: z.record(z.string(), z.unknown()).default({}),
  vi: z.record(z.string(), z.unknown()).default({}),
  en: z.record(z.string(), z.unknown()).default({}),
});
export type TourDraft = z.infer<typeof tourDraftSchema>;

/** Readable problems of an incomplete tour, e.g. ["en.title", "shared.images"], for the admin form. */
export function tourProblems(data: unknown): string[] {
  const parsed = tourDocumentSchema.safeParse(data);
  return parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
}

/**
 * Public view of a published tour in one locale, in the shape the pages already use. `imageSrc` resolves library
 * images (Cloudinary URL); static paths pass through.
 */
export function toTour(doc: TourDocument, slug: string, locale: TourLocale, imageSrc: (image: TourImage) => string | null = (i) => ("src" in i ? i.src : null)): Tour {
  const { shared } = doc;
  const t = doc[locale];
  const images = shared.images.map(imageSrc).filter((src): src is string => src !== null);
  return {
    slug,
    locale,
    title: t.title,
    summary: t.summary,
    departure: t.departure,
    groupSize: t.groupSize,
    highlights: t.highlights,
    itinerary: t.itinerary,
    includes: t.includes,
    excludes: t.excludes,
    pickupTime: t.pickupTime,
    bring: t.bring,
    activity: shared.activity,
    body: t.body,
    seoTitle: t.seoTitle || undefined,
    seoDescription: t.seoDescription || undefined,
    destination: shared.destination,
    days: shared.days,
    nights: shared.nights,
    price: shared.price,
    images,
    featured: shared.featured,
    order: shared.order,
    private: shared.private,
    pricing: shared.pricing,
    addons: shared.addons,
  };
}

/** One tour from its MDX files (one per locale): the import path from content/tours to the content module. */
export function fromMdxTours(byLocale: Record<TourLocale, Tour>): TourDocument {
  const vi = byLocale.vi;
  const pick = (t: Tour): TourText => ({
    title: t.title,
    summary: t.summary,
    departure: t.departure,
    groupSize: t.groupSize,
    highlights: t.highlights,
    itinerary: t.itinerary,
    includes: t.includes,
    excludes: t.excludes,
    pickupTime: t.pickupTime,
    bring: t.bring,
    body: t.body.trim(),
    seoTitle: "",
    seoDescription: "",
  });
  return tourDocumentSchema.parse({
    shared: {
      destination: vi.destination,
      days: vi.days,
      nights: vi.nights,
      price: vi.price,
      images: vi.images.map((src) => ({ src })),
      featured: vi.featured,
      activity: vi.activity,
      order: vi.order,
      private: vi.private,
      pricing: vi.pricing,
      addons: vi.addons,
    },
    vi: pick(vi),
    en: pick(byLocale.en),
  });
}
