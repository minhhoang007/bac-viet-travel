import { getSeoSite } from "@/bootstrap/seo";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/layout/legal-page";
import { createMetadata } from "@/core/seo";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getProductContent } from "@/product/content";
import { getPolicy } from "@/product/policies";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = getProductContent(locale).footer.payment;
  return createMetadata(getSeoSite(), { title, description: title, path: "/payment", locale });
}

export default async function PaymentPolicyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getAppContent(locale).legal;
  const doc = getPolicy(locale, "payment");
  return <LegalPage title={getProductContent(locale).footer.payment} updatedLabel={c.lastUpdated} updated={doc.updated} notice={c.templateNotice} sections={doc.sections} />;
}
