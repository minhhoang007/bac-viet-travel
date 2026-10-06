import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { fileBlog } from "@/app/_lib/blog";
import { getPublicEnv } from "@/bootstrap/env";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { BlogIndex } from "../../_index-view";

type Props = { params: Promise<{ locale: Locale; n: string }> };

// Unknown params render on demand and end in notFound() below (dynamicParams = false logs a NoFallbackError per 404).

// Exported only for file posts: database posts (blog source "content") render per request, and a route with
// generateStaticParams is static (request-time APIs would fail there).
export const generateStaticParams = fileBlog()
  ? ({ params }: { params: { locale: string } }) => {
      const { totalPages } = fileBlog()!.page(params.locale, 1);
      return Array.from({ length: totalPages - 1 }, (_, i) => ({ n: String(i + 2) }));
    }
  : undefined;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, n } = await params;
  const c = getAppContent(locale).blog;
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: `${c.title} (${n})`, description: c.subtitle, path: `/blog/page/${n}`, locale });
}

export default async function BlogPagedPage({ params }: Props) {
  const { locale, n } = await params;
  setRequestLocale(locale);
  const page = Number(n);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <BlogIndex locale={locale} page={page} />;
}
