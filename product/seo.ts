import { contactConfig } from "@/config/contact";
import { localizedUrl } from "@/core/seo";
import type { SeoSite } from "@/core/seo/metadata";

/**
 * BreadcrumbList structured data (G2): Google shows the path (site › Tours › Sapa) instead of the bare URL.
 * `trail` = site paths and names after the home page, in order.
 */
export function breadcrumbLd(site: SeoSite, locale: string, trail: { path: string; name: string }[]) {
  const items = [{ path: "/", name: contactConfig.companyName }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: localizedUrl(site, locale, item.path) })),
  };
}
