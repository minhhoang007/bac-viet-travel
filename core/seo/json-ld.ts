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
    ...(a.author ? { author: { "@type": "Person", name: a.author } } : {}),
    publisher: { "@type": "Organization", name: a.publisher },
  };
}
