import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const DESTINATIONS = ["ha-long", "ninh-binh", "sapa"] as const;
export type Destination = (typeof DESTINATIONS)[number];

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
const tourSchema = z.object({
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
}

export class TourContentError extends Error {}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseTour(file: string, source: string, locale: string): Tour {
  const slug = path.basename(file).replace(/\.mdx$/, "");
  if (!SLUG.test(slug)) throw new TourContentError(`${file}: file name must be a lowercase-with-dashes slug`);
  const match = source.match(FRONTMATTER);
  if (!match) throw new TourContentError(`${file}: missing frontmatter`);
  const parsed = tourSchema.safeParse(parseYaml(match[1]!));
  if (!parsed.success) {
    throw new TourContentError(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  if (parsed.data.nights > parsed.data.days) throw new TourContentError(`${file}: nights cannot exceed days`);
  return { ...parsed.data, slug, locale, body: source.slice(match[0].length) };
}

export interface TourCatalog {
  list(locale: string, options?: { destination?: Destination }): Tour[];
  featured(locale: string): Tour[];
  get(locale: string, slug: string): Tour | null;
  /** Other tours of the same destination. */
  related(tour: Tour, limit?: number): Tour[];
  /** Slugs present in every locale (for static params and the sitemap). */
  slugs(): string[];
}

export function createTourCatalog(dir: string, locales: readonly string[]): TourCatalog {
  const byLocale = new Map<string, Tour[]>();
  for (const locale of locales) {
    const folder = path.join(dir, locale);
    const files = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith(".mdx")) : [];
    const tours = files
      .map((f) => parseTour(path.join(folder, f), readFileSync(path.join(folder, f), "utf8"), locale))
      .sort((a, b) => DESTINATIONS.indexOf(a.destination) - DESTINATIONS.indexOf(b.destination) || a.order - b.order || a.slug.localeCompare(b.slug));
    byLocale.set(locale, tours);
  }
  // A tour must exist in every locale: the language switch and hreflang link to the same slug.
  const [first, ...others] = locales;
  const firstSlugs = new Set((byLocale.get(first!) ?? []).map((t) => t.slug));
  for (const locale of others) {
    const slugs = new Set((byLocale.get(locale) ?? []).map((t) => t.slug));
    const missing = [...firstSlugs].filter((s) => !slugs.has(s)).concat([...slugs].filter((s) => !firstSlugs.has(s)));
    if (missing.length) throw new TourContentError(`tours missing a translation (${first}/${locale}): ${missing.join(", ")}`);
  }

  const tours = (locale: string) => byLocale.get(locale) ?? [];
  return {
    list: (locale, { destination } = {}) => tours(locale).filter((t) => !destination || t.destination === destination),
    featured: (locale) => tours(locale).filter((t) => t.featured),
    get: (locale, slug) => tours(locale).find((t) => t.slug === slug) ?? null,
    related: (tour, limit = 3) => tours(tour.locale).filter((t) => t.destination === tour.destination && t.slug !== tour.slug).slice(0, limit),
    slugs: () => [...firstSlugs],
  };
}

let cached: TourCatalog | undefined;

/** Project catalog (read once; tour pages are prerendered). */
export function getTourCatalog(): TourCatalog {
  return (cached ??= createTourCatalog("content/tours", ["vi", "en"]));
}
