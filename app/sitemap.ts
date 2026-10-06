import type { MetadataRoute } from "next";
import { getBlog } from "@/bootstrap/blog";
import { getPublicEnv } from "@/bootstrap/env";
import { localizedUrl } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import { getContainer } from "@/bootstrap/container";
import type { SitemapContext } from "@/core/product/context";
import * as manifest from "@/product/manifest";

/** Starter public paths (without locale prefix); products add theirs via `sitemapPaths` in product/manifest.ts. */
const PATHS = ["/", "/terms", "/privacy"];

type ProductSitemapPaths = readonly string[] | ((ctx: SitemapContext) => Promise<readonly string[]>);
const productPaths = (manifest as { sitemapPaths?: ProductSitemapPaths }).sitemapPaths ?? [];

// Rendered per request (route config must be a literal): a dynamic sitemapPaths reads the database, which builds
// do not have. The container is only touched when sitemapPaths is a function.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const blog = getBlog();
  const extra = typeof productPaths === "function" ? await productPaths({ content: getContainer().app ? getContainer().content : undefined }) : productPaths;
  const shared = [...PATHS, ...(blog ? ["/blog"] : []), ...extra].map((path) => ({
    url: localizedUrl(site, site.defaultLocale, path),
    alternates: { languages: Object.fromEntries(site.locales.map((l) => [l, localizedUrl(site, l, path)])) },
  }));
  // Posts have per-locale slugs: one entry per post, alternates only for existing translations.
  const posts = blog
    ? site.locales.flatMap((locale) =>
        blog.list(locale).map((post) => ({
          url: localizedUrl(site, locale, `/blog/${post.slug}`),
          lastModified: post.updated ?? post.date,
          alternates: {
            languages: Object.fromEntries(
              Object.entries({ ...blog.translations(post), [locale]: post.slug }).map(([l, slug]) => [l, localizedUrl(site, l, `/blog/${slug}`)]),
            ),
          },
        })),
      )
    : [];
  return [...shared, ...posts];
}
