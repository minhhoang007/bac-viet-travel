import { appConfig } from "@/config/app";
import { seoConfig } from "@/config/seo";
import type { SeoSite } from "./metadata";

/** SEO site settings from config. siteUrl is passed in so env stays read in bootstrap only. */
export function seoSite(siteUrl: string): SeoSite {
  return {
    siteUrl,
    siteName: appConfig.name,
    titleTemplate: seoConfig.titleTemplate,
    defaultOgImage: seoConfig.defaultOgImage,
    locales: appConfig.locales,
    defaultLocale: appConfig.defaultLocale,
    twitterHandle: seoConfig.twitterHandle,
  };
}
