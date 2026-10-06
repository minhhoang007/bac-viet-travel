import type { Logger } from "@/core/logger";
import type { PublishedContent } from "@/core/product/context";
import { catalogFromTours, type Tour, type TourCatalog } from "./catalog";
import { TOUR_LOCALES, toTour, tourDocumentSchema } from "./document";

/** Cache tag of everything built from published tours: revalidated on publish / hide / show (manifest contentTypes). */
export const TOURS_CACHE_TAG = "tours";
export const TOUR_CONTENT_TYPE = "tour";

/** What gets cached: plain JSON (dates and class instances do not survive the cache). */
type PublishedTourRow = { slug: string; data: Record<string, unknown> };

export interface TourSource {
  catalog(): Promise<TourCatalog>;
}

export interface TourSourceDeps {
  /** Published tours (content module); undefined = read the MDX fallback. */
  listPublished?: (type: string) => Promise<PublishedContent[]>;
  /** Wraps the database read in a cache (Next.js data cache in the app; none in scripts and tests). */
  cache?: (load: () => Promise<PublishedTourRow[]>) => () => Promise<PublishedTourRow[]>;
  fallback: () => TourCatalog;
  logger: Logger;
}

/**
 * Tours for the public site: published tours of the content module, or the MDX files. A published tour that no
 * longer matches the schema is skipped and logged (never a broken page); editors fix it in the admin.
 */
export function createTourSource(deps: TourSourceDeps): TourSource {
  const { listPublished } = deps;
  if (!listPublished) return { catalog: async () => deps.fallback() };

  const load = async () => (await listPublished(TOUR_CONTENT_TYPE)).map((r) => ({ slug: r.slug, data: r.data }));
  const rows = deps.cache ? deps.cache(load) : load;

  return {
    async catalog() {
      const byLocale = new Map<string, Tour[]>(TOUR_LOCALES.map((l) => [l, []]));
      for (const row of await rows()) {
        const parsed = tourDocumentSchema.safeParse(row.data);
        if (!parsed.success) {
          deps.logger.error("tours.invalid_published", { slug: row.slug, fields: parsed.error.issues.map((i) => i.path.join(".")) });
          continue;
        }
        // Library images resolve once the media module is on (P3); static paths pass through.
        for (const locale of TOUR_LOCALES) byLocale.get(locale)!.push(toTour(parsed.data, row.slug, locale));
      }
      return catalogFromTours(byLocale, TOUR_LOCALES);
    },
  };
}
