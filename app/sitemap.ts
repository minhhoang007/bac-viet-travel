import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/bootstrap/env";
import { localizedUrl } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import { sitemapPaths } from "@/product/manifest";

/** Starter public paths (without locale prefix); products add theirs via `sitemapPaths` in product/manifest.ts. */
const PATHS = ["/", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  return [...PATHS, ...sitemapPaths].map((path) => ({
    url: localizedUrl(site, site.defaultLocale, path),
    alternates: { languages: Object.fromEntries(site.locales.map((l) => [l, localizedUrl(site, l, path)])) },
  }));
}
