import type { Metadata } from "next";
import { getSeoSite } from "@/bootstrap/seo";
import { createMetadata } from "@/core/seo";
import { getProductContent } from "@/product/content";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/layout/legal-page";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getLegalDocument, legalIsTemplate } from "@/content/legal";
import { currentCompany } from "@/app/_lib/company";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return createMetadata(getSeoSite(), { title: getAppContent(locale).legal.terms, description: getProductContent(locale).footer.policyDescriptions.terms, path: "/terms", locale });
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getAppContent(locale).legal;
  const doc = getLegalDocument(locale, "terms", await currentCompany());
  return <LegalPage title={c.terms} updatedLabel={c.lastUpdated} updated={doc.updated} notice={legalIsTemplate ? c.templateNotice : undefined} sections={doc.sections} />;
}
