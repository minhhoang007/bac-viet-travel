import type { Locale } from "@/config/app";
import type { DashboardData } from "@/product/booking/dashboard";
import { requireAppServices } from "./session";

/** Data of the admin dashboard and tour titles by slug (the page itself is admin-only: /admin). */
export async function loadDashboard(locale: Locale): Promise<{ data: DashboardData; tourTitle: (slug: string) => string }> {
  const app = await requireAppServices();
  const [data, catalog] = await Promise.all([app.product.dashboard.data(), app.product.tours.catalog()]);
  const titles = new Map(catalog.list(locale).map((t) => [t.slug, t.title]));
  return { data, tourTitle: (slug) => titles.get(slug) ?? slug };
}
