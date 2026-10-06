import { cache } from "react";
import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { getTourCatalog, type Tour, type TourCatalog } from "@/product/tours/catalog";
import { getContainer } from "@/bootstrap/container";
import { toTour, tourDocumentSchema, tourProblems, type TourLocale } from "@/product/tours/document";
import { TOUR_CONTENT_TYPE, TOURS_CACHE_TAG } from "@/product/tours/source";
import { readContent } from "./content";
import { requireAppServices } from "./session";

/**
 * Tour catalog for pages and actions: published tours from the CMS (cached, revalidated on publish) or the MDX
 * fallback (config/tours.ts). Renders the page at request time: builds have no database.
 */
export async function getTours(): Promise<TourCatalog> {
  const app = await requireAppServices();
  return app.product.tours.catalog();
}

export type TourPageData = { tour: Tour; preview: boolean } | { preview: true; problems: string[] } | { moved: string } | null;

/**
 * The tour of a public page: in Draft Mode (staff preview from the admin) the working copy, otherwise the published
 * tour; an old slug of a live tour gives `moved` (permanent redirect, from a cached map). Once per request
 * (metadata and page share it).
 */
export const getTourPage = cache(async (locale: TourLocale, slug: string): Promise<TourPageData> => {
  if ((await draftMode()).isEnabled) {
    const item = await readContent(TOUR_CONTENT_TYPE, slug);
    if (item?.preview) {
      const parsed = tourDocumentSchema.safeParse(item.data);
      return parsed.success ? { tour: toTour(parsed.data, item.slug, locale), preview: true } : { preview: true, problems: tourProblems(item.data) };
    }
  }
  // No request-time API here: the public tour page is static (edge-cached), regenerated on publish (tag "tours").
  const tour = (await getPublicTours()).get(locale, slug);
  if (tour) return { tour, preview: false };
  const moved = await appServices()?.product.tours.moved(slug);
  return moved ? { moved } : null;
});

/**
 * Published tours without forcing request-time rendering (data cache, tag "tours"), for static pages such as the
 * home page: they are regenerated when a tour is published. A build without a database uses the MDX tours (the same
 * tours `tours:import` copies).
 */
export async function getPublicTours(): Promise<TourCatalog> {
  const app = appServices();
  if (app) return app.product.tours.catalog();
  // Still read through a "tours"-tagged cache entry, so the first publish regenerates the page with database tours.
  await fileFallbackTag();
  return getTourCatalog();
}

/** App services when the database is configured; undefined in a build without one. */
function appServices() {
  try {
    return getContainer().app;
  } catch {
    return undefined;
  }
}

const fileFallbackTag = unstable_cache(async () => true, ["tours:file-fallback"], { tags: [TOURS_CACHE_TAG] });
