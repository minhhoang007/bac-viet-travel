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
  /** Current slug of a live tour once published under `slug` (old URL → permanent redirect); null otherwise. */
  moved(slug: string): Promise<string | null>;
}

export interface TourSourceDeps {
  /** Published tours (content module); undefined = read the MDX fallback. */
  listPublished?: (type: string) => Promise<PublishedContent[]>;
  /** Old published slugs → current ones (content module). */
  listMoved?: (type: string) => Promise<{ from: string; to: string }[]>;
  /** Wraps a database read in a cache under `key` (Next.js data cache in the app; none in scripts and tests). */
  cache?: <T>(key: string, load: () => Promise<T>) => () => Promise<T>;
  fallback: () => TourCatalog;
  logger: Logger;
}

/**
 * Tours for the public site: published tours of the content module, or the MDX files. A published tour that no
 * longer matches the schema is skipped and logged (never a broken page); editors fix it in the admin.
 */
export function createTourSource(deps: TourSourceDeps): TourSource {
  const { listPublished } = deps;
  if (!listPublished) return { catalog: async () => deps.fallback(), moved: async () => null };

  const cached = <T,>(key: string, load: () => Promise<T>) => (deps.cache ? deps.cache(key, load) : load);
  const rows = cached("tours:published", async (): Promise<PublishedTourRow[]> => (await listPublished(TOUR_CONTENT_TYPE)).map((r) => ({ slug: r.slug, data: r.data })));
  // One cached map for every old URL: an unknown slug (bots, typos) never reaches the database on its own.
  const { listMoved } = deps;
  const redirects = cached("tours:moved", async () => (listMoved ? await listMoved(TOUR_CONTENT_TYPE) : []));

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
    async moved(slug) {
      return (await redirects()).find((r) => r.from === slug)?.to ?? null;
    },
  };
}
