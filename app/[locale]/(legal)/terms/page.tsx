import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/layout/legal-page";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getLegalDocument } from "@/content/legal";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).legal.terms };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getAppContent(locale).legal;
  const doc = getLegalDocument(locale, "terms");
  return <LegalPage title={c.terms} updatedLabel={c.lastUpdated} updated={doc.updated} notice={c.templateNotice} sections={doc.sections} />;
}
