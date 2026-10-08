import { appConfig } from "@/config/app";
import { seoConfig } from "@/config/seo";
import type { SeoSite } from "./metadata";

/**
 * SEO site settings from config. siteUrl and the share-image key are passed in so env stays read in bootstrap only
 * (bootstrap/seo.ts getSeoSite()).
 */
export function seoSite(siteUrl: string, ogSecret?: string): SeoSite {
  return {
    siteUrl,
    ogSecret,
    siteName: appConfig.name,
    titleTemplate: seoConfig.titleTemplate,
    defaultOgImage: seoConfig.defaultOgImage,
    dynamicOgImage: seoConfig.dynamicOgImage,
    locales: appConfig.locales,
    defaultLocale: appConfig.defaultLocale,
    twitterHandle: seoConfig.twitterHandle,
  };
}
