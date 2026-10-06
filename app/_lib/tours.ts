import type { TourCatalog } from "@/product/tours/catalog";
import { requireAppServices } from "./session";

/**
 * Tour catalog for pages and actions: published tours from the CMS (cached, revalidated on publish) or the MDX
 * fallback (config/tours.ts). Renders the page at request time: builds have no database.
 */
export async function getTours(): Promise<TourCatalog> {
  const app = await requireAppServices();
  return app.product.tours.catalog();
}
