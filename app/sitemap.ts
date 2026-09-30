import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/bootstrap/env";
import { localizedUrl } from "@/core/seo";
import { seoSite } from "@/core/seo/site";

/** Public paths (without locale prefix). Product routes are appended here by projects. */
const PATHS = ["/"];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  return PATHS.map((path) => ({
    url: localizedUrl(site, site.defaultLocale, path),
    alternates: { languages: Object.fromEntries(site.locales.map((l) => [l, localizedUrl(site, l, path)])) },
  }));
}
