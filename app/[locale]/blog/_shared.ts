import { notFound } from "next/navigation";
import { getBlog } from "@/bootstrap/blog";
import type { PostListItem } from "@/components/blog/post-list";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import type { Blog, PostSummary } from "@/modules/blog";

/** The blog or a 404 when the module is off. */
export function requireBlog(): Blog {
  const blog = getBlog();
  if (!blog) notFound();
  return blog;
}

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
    tags: post.tags.map((t) => ({ label: t, href: localePath(locale, `/blog/tag/${t}`) })),
  };
}
