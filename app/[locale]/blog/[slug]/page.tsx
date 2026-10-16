import type { ReactNode } from "react";
import { getSeoSite } from "@/bootstrap/seo";
import type { Metadata } from "next";
import Image from "next/image";
import { PageLink } from "@/components/layout/page-transition";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { fileBlog, loadBlog, movedPost } from "@/app/_lib/blog";
import { readContent } from "@/app/_lib/content";
import { POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { PreviewBanner } from "@/components/content/preview-banner";
import { MarkdownContent } from "@/components/blog/markdown";
import { MdxContent } from "@/components/blog/mdx";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { articleJsonLd, createMetadata, localizedUrl, serializeJsonLd } from "@/core/seo";
import { appConfig, type Locale } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { getAppContent } from "@/content";
import { postFromContent, type Blog, type Post } from "@/modules/blog";
import { UNSPLASH_UTM } from "@/product/media/unsplash";
import { formatDate, requireBlog, tagLabel, toListItem } from "../_shared";
import { PostList } from "@/components/blog/post-list";
import * as productLayout from "@/product/layout";
import { breadcrumbLd } from "@/product/seo";

// Project hook under a post (product/layout.tsx), optional like the other layout hooks.
const ProductPostFooter = "ProductPostFooter" in productLayout ? (productLayout as { ProductPostFooter?: (p: { locale: Locale; tags: string[]; slug: string }) => ReactNode }).ProductPostFooter : undefined;

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
  return createMetadata(getSeoSite(), {
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
  const site = getSeoSite();
  const translations = Object.entries(blog.translations(post));
  // Up to three other posts sharing a tag, newest first.
  const related = blog
    .list(locale)
    .filter((p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)))
    .slice(0, 3);
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd([jsonLd, breadcrumbLd(site, locale, [{ path: "/blog", name: c.title }, { path: `/blog/${slug}`, name: post.title }])]) }}
      />
      <PageLink href={localePath(locale, "/blog")} className="text-sm text-muted-foreground hover:underline">
        ← {c.allPosts}
      </PageLink>
      {/* blog-* class names are stable hooks for project CSS (product/styles.css). */}
      <article className="blog-post mt-4">
        <header>
          <h1 className="blog-title text-3xl font-bold sm:text-4xl">{post.title}</h1>
          <p className="blog-meta mt-3 text-sm text-muted-foreground">
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
        {post.cover && (
          <figure className="mt-8">
            <div className="blog-cover relative aspect-[16/9] overflow-hidden rounded-lg">
              <Image src={post.cover} alt="" fill priority sizes="(min-width: 768px) 768px, 100vw" unoptimized={!post.cover.startsWith("/")} className="object-cover" />
            </div>
            {/* Licensed photos (Unsplash) credit the photographer with a link back. */}
            {post.coverCredit && (
              <figcaption className="mt-2 text-xs text-muted-foreground" data-testid="cover-credit">
                {c.photoBy}{" "}
                <a href={post.coverCredit.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {post.coverCredit.name}
                </a>{" "}
                /{" "}
                <a href={`https://unsplash.com/?${UNSPLASH_UTM}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Unsplash
                </a>
              </figcaption>
            )}
          </figure>
        )}
        <div className="prose-blog mt-8">
          {post.format === "mdx" ? <MdxContent source={post.body} /> : <MarkdownContent source={post.body} />}
        </div>
        {post.tags.length > 0 && (
          <ul className="blog-tags mt-10 flex flex-wrap gap-2 text-sm">
            {post.tags.map((t) => (
              <li key={t}>
                <PageLink href={localePath(locale, `/blog/tag/${t}`)} className="rounded-full border border-border px-3 py-1 hover:bg-muted">
                  {tagLabel(t, locale)}
                </PageLink>
              </li>
            ))}
          </ul>
        )}
      </article>
      {/* Project hook: what to do next (tours for this destination, a question by chat). */}
      {ProductPostFooter && <ProductPostFooter locale={locale} tags={post.tags} slug={post.slug} />}
      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10" aria-labelledby="related-posts" data-testid="related-posts">
          <h2 id="related-posts" className="font-heading type-h3">
            {c.related}
          </h2>
          <div className="mt-6">
            <PostList posts={related.map((p) => toListItem(p, locale))} empty="" />
          </div>
        </section>
      )}
    </Container>
    </>
  );
}
