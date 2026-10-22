import { localizedUrl, type SeoSite } from "./metadata";

/**
 * Serializes structured data for `<script type="application/ld+json">`.
 * Escapes characters that could close the script element or break parsing, so user/CMS text is safe.
 */
export function serializeJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface ArticleLd {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  /** The author is a team or company (schema.org Organization), not a person. */
  authorIsOrganization?: boolean;
  /** A page about the author. */
  authorUrl?: string;
  publisher: string;
  locale: string;
}

/** schema.org BlogPosting for a blog post page. */
export function articleJsonLd(a: ArticleLd): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    mainEntityOfPage: a.url,
    url: a.url,
    inLanguage: a.locale,
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    ...(a.image ? { image: [a.image] } : {}),
    ...(a.author ? { author: { "@type": a.authorIsOrganization ? "Organization" : "Person", name: a.author, ...(a.authorUrl ? { url: a.authorUrl } : {}) } } : {}),
    publisher: { "@type": "Organization", name: a.publisher },
  };
}

/**
 * schema.org BreadcrumbList: search results show the path (site › Blog › Post) instead of the bare URL.
 * `home`: the name of the home page (the site); `trail`: locale-less paths and names after it, in order.
 */
export function breadcrumbJsonLd(site: SeoSite, locale: string, home: string, trail: { path: string; name: string }[]): Record<string, unknown> {
  const items = [{ path: "/", name: home }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: localizedUrl(site, locale, item.path) })),
  };
}
