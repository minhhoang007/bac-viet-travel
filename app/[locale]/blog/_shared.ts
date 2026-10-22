import { notFound } from "next/navigation";
import { loadBlog } from "@/app/_lib/blog";
import type { PostListItem } from "@/components/blog/post-list";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { getAppContent } from "@/content";
import type { Blog, PostSummary } from "@/modules/blog";

/** The blog or a 404 when the module is off. */
export async function requireBlog(): Promise<Blog> {
  const blog = await loadBlog();
  if (!blog) notFound();
  return blog;
}

/** A tag as readers see it: its configured name in this locale (config/blog.ts tagLabels), else the tag. */
export const tagLabel = (tag: string, locale: Locale) => blogConfig.tagLabels[tag]?.[locale] ?? tag;

export const formatDate = (date: string, locale: Locale) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function toListItem(post: PostSummary, locale: Locale): PostListItem {
  const c = getAppContent(locale).blog;
  return {
    href: localePath(locale, `/blog/${post.slug}`),
    title: post.title,
    description: post.description,
    date: formatDate(post.date, locale),
    readingTime: c.readingTime.replace("{n}", String(post.readingMinutes)),
    tags: post.tags.map((t) => ({ label: tagLabel(t, locale), href: localePath(locale, `/blog/tag/${t}`) })),
    cover: post.cover,
    facts: post.facts,
  };
}
