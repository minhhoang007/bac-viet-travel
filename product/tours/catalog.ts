import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export { DESTINATIONS, type Destination, type Tour, type TourData } from "./model";
import { DESTINATIONS, tourSchema, type Destination, type Tour } from "./model";

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
    byLocale.set(
      locale,
      files.map((f) => parseTour(path.join(folder, f), readFileSync(path.join(folder, f), "utf8"), locale)),
    );
  }
  return catalogFromTours(byLocale, locales);
}

/**
 * Catalog over tours already loaded per locale (MDX files or published content). Sorts by destination, then order;
 * every tour must exist in every locale (the language switch and hreflang link to the same slug).
 */
export function catalogFromTours(loaded: Map<string, Tour[]>, locales: readonly string[]): TourCatalog {
  const byLocale = new Map(
    locales.map((locale) => [
      locale,
      [...(loaded.get(locale) ?? [])].sort(
        (a, b) => DESTINATIONS.indexOf(a.destination) - DESTINATIONS.indexOf(b.destination) || a.order - b.order || a.slug.localeCompare(b.slug),
      ),
    ]),
  );
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

/** Catalog from the MDX files (read once): the source before the CMS, and the fallback (config/tours.ts). */
export function getTourCatalog(): TourCatalog {
  return (cached ??= createTourCatalog("content/tours", ["vi", "en"]));
}
