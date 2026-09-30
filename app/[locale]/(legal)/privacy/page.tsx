import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/layout/legal-page";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getLegalDocument } from "@/content/legal";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).legal.privacy };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getAppContent(locale).legal;
  const doc = getLegalDocument(locale, "privacy");
  return <LegalPage title={c.privacy} updatedLabel={c.lastUpdated} updated={doc.updated} notice={c.templateNotice} sections={doc.sections} />;
}
