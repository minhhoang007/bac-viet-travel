import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/config/app";
import { getMarketingContent } from "@/content";

// Unknown URLs under a locale render the site's 404 (app/[locale]/not-found.tsx: header, footer, translated text)
// instead of the framework's bare English page. Real routes always win over this catch-all.

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  // Pages need a <title> (WCAG 2.4.2); never indexed.
  return { title: getMarketingContent(locale).notFound.title, robots: { index: false } };
}

export default function UnknownPage() {
  notFound();
}
