import { defaultContact as contactConfig } from "@/config/contact";
import { breadcrumbJsonLd } from "@/core/seo";
import type { SeoSite } from "@/core/seo/metadata";

/**
 * BreadcrumbList structured data (G2): Google shows the path (site › Tours › Sapa) instead of the bare URL.
 * `trail` = site paths and names after the home page, in order.
 */
export function breadcrumbLd(site: SeoSite, locale: string, trail: { path: string; name: string }[]) {
  return breadcrumbJsonLd(site, locale, contactConfig.companyName, trail);
}
