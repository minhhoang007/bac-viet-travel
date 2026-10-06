import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { fileBlog, loadBlog, movedPost } from "@/app/_lib/blog";
import { readContent } from "@/app/_lib/content";
import { POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { PreviewBanner } from "@/components/content/preview-banner";
import { MarkdownContent } from "@/components/blog/markdown";
import { getPublicEnv } from "@/bootstrap/env";
import { MdxContent } from "@/components/blog/mdx";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { articleJsonLd, createMetadata, localizedUrl, serializeJsonLd } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import { appConfig, type Locale } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { getAppContent } from "@/content";
import { postFromContent, type Blog, type Post } from "@/modules/blog";
import { formatDate, requireBlog } from "../_shared";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

// File posts are prerendered; database posts (blog source "content") render on demand from a cached copy.
// Unknown params render on demand and end in notFound() below (dynamicParams = false logs a NoFallbackError per 404).

// File posts are prerendered. Database posts (blog source "content") render per request from the cached posts: a
// static copy of an unknown URL would keep its 404 after the post is published. No static params then (a route with
// generateStaticParams is static, and request-time APIs would fail there).
export const generateStaticParams = fileBlog()
  ? ({ params }: { params: { locale: string } }) => (fileBlog()?.list(params.locale) ?? []).map((p) => ({ slug: p.slug }))
  : undefined;

/** The published post, or in Draft Mode (staff preview of a database post) the working copy. */
async function findPost(locale: string, slug: string): Promise<{ blog: Blog; post: Post; preview: boolean } | null> {
  if (blogConfig.source === "content") await connection();
  const blog = await loadBlog();
  if (!blog) return null;
  if (blogConfig.source === "content") {
    const item = await readContent(POST_CONTENT_TYPE, slug);
    if (item?.preview) {
      const post = postFromContent(item.slug, item.data, blogConfig.wordsPerMinute);
      if (post) return { blog, post, preview: true };
    }
  }
  const post = blog.get(locale, slug);
  return post ? { blog, post, preview: false } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = await findPost(locale, slug);
  if (!found) return {};
  const { post } = found;
  const translations = found.blog.translations(post);
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), {
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
    locale,
    image: post.cover,
    alternatePaths: Object.fromEntries(Object.entries(translations).map(([l, s]) => [l, `/blog/${s}`])),
    article: {
      publishedTime: post.date,
      modifiedTime: post.updated,
      authors: [post.author ?? blogConfig.defaultAuthor].filter(Boolean),
      tags: post.tags,
    },
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireBlog();
  const found = await findPost(locale, slug);
  if (!found) {
    // A post renamed in the admin: its old URL keeps working (shared links, search ranking).
    const moved = await movedPost(slug);
    if (moved) permanentRedirect(localePath(locale, `/blog/${moved}`));
    notFound();
  }
  const { blog, post, preview } = found;
  const c = getAppContent(locale).blog;
  const w = getAppContent(locale).admin.content;
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const translations = Object.entries(blog.translations(post));
  const author = post.author ?? (blogConfig.defaultAuthor || undefined);
  const jsonLd = articleJsonLd({
    title: post.title,
    description: post.description,
    url: localizedUrl(site, locale, `/blog/${slug}`),
    image: post.cover ? new URL(post.cover, site.siteUrl).toString() : undefined,
    datePublished: post.date,
    dateModified: post.updated,
    author,
    publisher: appConfig.name,
    locale,
  });

  return (
    <>
    {preview && <PreviewBanner label={w.previewing} exit={w.exitPreview} href={`/api/content/preview?exit=1&locale=${locale}`} />}
    <Container className="max-w-3xl py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <a href={localePath(locale, "/blog")} className="text-sm text-muted-foreground hover:underline">
        ← {c.allPosts}
      </a>
      <article className="mt-4">
        <header>
          <h1 className="text-3xl font-bold sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <time dateTime={post.date}>{formatDate(post.date, locale)}</time>
            {post.updated && ` · ${c.updated} ${formatDate(post.updated, locale)}`}
            {` · ${c.readingTime.replace("{n}", String(post.readingMinutes))}`}
            {author && ` · ${author}`}
          </p>
          {translations.map(([l, s]) => (
            <a key={l} href={localePath(l, `/blog/${s}`)} hrefLang={l} className="mt-2 inline-block text-sm underline">
              {c.otherLanguage}
            </a>
          ))}
        </header>
        <div className="prose-blog mt-8">
          {post.format === "mdx" ? <MdxContent source={post.body} /> : <MarkdownContent source={post.body} />}
        </div>
        {post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2 text-sm">
            {post.tags.map((t) => (
              <li key={t}>
                <a href={localePath(locale, `/blog/tag/${t}`)} className="rounded-full border border-border px-3 py-1 hover:bg-muted">
                  #{t}
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>
    </Container>
    </>
  );
}
