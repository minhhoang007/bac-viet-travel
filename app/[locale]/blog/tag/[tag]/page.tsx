import { getSeoSite } from "@/bootstrap/seo";
import type { Metadata } from "next";
import { PageLink } from "@/components/layout/page-transition";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { fileBlog } from "@/app/_lib/blog";
import { PostList } from "@/components/blog/post-list";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { requireBlog, toListItem } from "../../_shared";

type Props = { params: Promise<{ locale: Locale; tag: string }> };

// Unknown params render on demand and end in notFound() below (dynamicParams = false logs a NoFallbackError per 404).

// File posts are prerendered; database posts (blog source "content") are generated on first request and cached
// until a publish revalidates the "blog" tag. Hourly revalidation is the safety net.
export const revalidate = 3600;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  return (fileBlog()?.tags(params.locale) ?? []).map((t) => ({ tag: t.tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tag } = await params;
  const c = getAppContent(locale).blog;
  // Tag pages exist per locale only: no hreflang alternates.
  return createMetadata(getSeoSite(), {
    title: `${c.tagTitle} #${tag}`,
    description: c.subtitle,
    path: `/blog/tag/${tag}`,
    locale,
    alternatePaths: {},
  });
}

export default async function BlogTagPage({ params }: Props) {
  const { locale, tag } = await params;
  setRequestLocale(locale);
  const blog = await requireBlog();
  const posts = blog.list(locale, { tag });
  if (posts.length === 0) notFound();
  const c = getAppContent(locale).blog;

  return (
    <Container className="max-w-3xl py-16">
      <PageLink href={localePath(locale, "/blog")} className="text-sm text-muted-foreground hover:underline">
        ← {c.allPosts}
      </PageLink>
      <h1 className="mt-4 text-3xl font-bold">
        {c.tagTitle} #{tag}
      </h1>
      <div className="mt-10">
        <PostList posts={posts.map((p) => toListItem(p, locale))} empty={c.empty} />
      </div>
    </Container>
  );
}
