import { cache } from "react";
import { draftMode } from "next/headers";
import type { Tour, TourCatalog } from "@/product/tours/catalog";
import { toTour, tourDocumentSchema, tourProblems, type TourLocale } from "@/product/tours/document";
import { TOUR_CONTENT_TYPE } from "@/product/tours/source";
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
  const tours = (await requireAppServices()).product.tours;
  const tour = (await tours.catalog()).get(locale, slug);
  if (tour) return { tour, preview: false };
  const moved = await tours.moved(slug);
  return moved ? { moved } : null;
});
