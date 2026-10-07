import type { Locale } from "@/config/app";
import type { DashboardData } from "@/product/booking/dashboard";
import { getContainer } from "@/bootstrap/container";
import { requireAppServices } from "./session";

/**
 * Data of the admin dashboard and tour titles by slug (the page itself is admin-only: /admin). A failure is logged
 * (no figures in the log) and rethrown for the caller to show a notice.
 */
export async function loadDashboard(locale: Locale): Promise<{ data: DashboardData; tourTitle: (slug: string) => string }> {
  const app = await requireAppServices();
  try {
    const [data, catalog] = await Promise.all([app.product.dashboard.data(), app.product.tours.catalog()]);
    const titles = new Map(catalog.list(locale).map((t) => [t.slug, t.title]));
    return { data, tourTitle: (slug) => titles.get(slug) ?? slug };
  } catch (error) {
    getContainer().logger.warn("dashboard.load_failed", { error });
    throw error;
  }
}
