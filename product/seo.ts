import { appConfig } from "@/config/app";
import { breadcrumbJsonLd } from "@/core/seo";
import type { SeoSite } from "@/core/seo/metadata";

/**
 * BreadcrumbList structured data (G2): Google shows the path (site › Tours › Sapa) instead of the bare URL.
 * `trail` = site paths and names after the home page, in order. The home page is the site's name, as on blog posts.
 */
export function breadcrumbLd(site: SeoSite, locale: string, trail: { path: string; name: string }[]) {
  return breadcrumbJsonLd(site, locale, appConfig.name, trail);
}
