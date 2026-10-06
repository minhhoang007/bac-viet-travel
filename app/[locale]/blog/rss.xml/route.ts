import { loadBlog } from "@/app/_lib/blog";
import { getPublicEnv } from "@/bootstrap/env";
import { localizedUrl } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";

// Built per request from the loaded blog (files are traced into the function; database posts are cached), CDN-cached.

const xml = (s: string) => s.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]!);

/** RSS 2.0 feed per locale: the 20 newest posts. */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }): Promise<Response> {
  const blog = await loadBlog();
  if (!blog) return new Response("Not found", { status: 404 });
  const { locale } = await params;
  if (!appConfig.locales.includes(locale as Locale)) return new Response("Not found", { status: 404 });
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const c = getAppContent(locale as Locale).blog;
  const items = blog
    .list(locale)
    .slice(0, 20)
    .map((p) => {
      const url = localizedUrl(site, locale, `/blog/${p.slug}`);
      return `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <description>${xml(p.description)}</description>
      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
${p.tags.map((t) => `      <category>${xml(t)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(`${c.title} | ${site.siteName}`)}</title>
    <link>${xml(localizedUrl(site, locale, "/blog"))}</link>
    <description>${xml(c.subtitle)}</description>
    <language>${locale}</language>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
