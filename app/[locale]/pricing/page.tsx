import { getSeoSite } from "@/bootstrap/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Pricing } from "@/components/marketing/pricing";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import type { Locale } from "@/config/app";
import { billingConfig } from "@/config/billing";
import type { PlanId } from "@/config/billing.defaults";
import { features } from "@/config/features";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getAppContent(locale).billing;
  return createMetadata(getSeoSite(), { title: c.pricingTitle, description: c.pricingSubtitle, path: "/pricing", locale });
}

/** Public pricing page, from config/billing.ts. Exists only when the billing module is on. */
export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!features.billing) notFound();
  const c = getAppContent(locale).billing;
  const vnd = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
  const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  return (
    <Pricing
      as="h1"
      title={c.pricingTitle}
      subtitle={c.pricingSubtitle}
      plans={(Object.keys(billingConfig.plans) as PlanId[]).map((id) => {
        const plan = billingConfig.plans[id];
        return {
          name: plan.name[locale],
          price: locale === "vi" ? vnd(plan.prices?.vnd.month ?? 0) : usd(plan.prices?.usd.month ?? 0),
          period: plan.prices ? c.perMonth : undefined,
          cta: { label: c.choosePlan, href: localePath(locale, "/dashboard/billing") },
        };
      })}
    />
  );
}
