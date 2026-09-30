import type { Metadata } from "next";

export interface SeoSite {
  siteUrl: string;
  siteName: string;
  titleTemplate: string;
  defaultOgImage: string;
  locales: readonly string[];
  defaultLocale: string;
  twitterHandle?: string;
}

export interface PageSeo {
  title: string;
  description: string;
  /** Path without locale prefix, e.g. "/" or "/pricing". */
  path: string;
  locale: string;
  image?: string;
  noIndex?: boolean;
}

export function localizedUrl(site: SeoSite, locale: string, path: string): string {
  const clean = path === "/" ? "" : path;
  const prefix = locale === site.defaultLocale ? "" : `/${locale}`;
  return new URL(`${prefix}${clean}` || "/", site.siteUrl).toString();
}

export function createMetadata(site: SeoSite, page: PageSeo): Metadata {
  const url = localizedUrl(site, page.locale, page.path);
  const image = new URL(page.image ?? site.defaultOgImage, site.siteUrl).toString();
  const languages = Object.fromEntries(site.locales.map((l) => [l, localizedUrl(site, l, page.path)]));

  return {
    metadataBase: new URL(site.siteUrl),
    title: { absolute: site.titleTemplate.replace("%s", page.title) },
    description: page.description,
    alternates: { canonical: url, languages: { ...languages, "x-default": localizedUrl(site, site.defaultLocale, page.path) } },
    openGraph: {
      type: "website",
      url,
      siteName: site.siteName,
      title: page.title,
      description: page.description,
      locale: page.locale,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image],
      ...(site.twitterHandle ? { site: site.twitterHandle } : {}),
    },
    robots: page.noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
