import { seoSite } from "@/core/seo/site";
import type { SeoSite } from "@/core/seo";
import { getPublicEnv } from "./env";

/**
 * Key that signs share-image titles (/api/og): OG_IMAGE_SECRET, else the auth secret. Read straight from the
 * environment, because metadata also renders in builds without secrets: then images are the generic one.
 */
export const ogImageSecret = (): string | undefined => process.env.OG_IMAGE_SECRET || process.env.BETTER_AUTH_SECRET || undefined;

/** SEO site settings for metadata, sitemaps and feeds (server only: carries the share-image key). */
export const getSeoSite = (): SeoSite => seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL, ogImageSecret());
