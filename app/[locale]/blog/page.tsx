import { getSeoSite } from "@/bootstrap/seo";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { BlogIndex } from "./_index-view";

type Props = { params: Promise<{ locale: Locale }> };

// Static; regenerated when a post is published (tag "blog") or hourly.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getAppContent(locale).blog;
  const m = createMetadata(getSeoSite(), { title: c.title, description: c.subtitle, path: "/blog", locale });
  return { ...m, alternates: { ...m.alternates, types: { "application/rss+xml": localePath(locale, "/blog/rss.xml") } } };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BlogIndex locale={locale} page={1} />;
}
