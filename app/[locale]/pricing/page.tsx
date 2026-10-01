import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { billingConfig } from "@/config/billing";
import type { PlanId } from "@/config/billing.defaults";
import { features } from "@/config/features";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getAppContent(locale).billing;
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: c.pricingTitle, description: c.pricingSubtitle, path: "/pricing", locale });
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
    <Container className="py-16">
      <h1 className="text-center text-3xl font-bold">{c.pricingTitle}</h1>
      <p className="mt-2 text-center text-muted-foreground">{c.pricingSubtitle}</p>
      <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
        {(Object.keys(billingConfig.plans) as PlanId[]).map((id) => {
          const plan = billingConfig.plans[id];
          return (
            <article key={id} className="flex flex-col rounded-lg border border-border p-6">
              <h2 className="text-xl font-semibold">{plan.name[locale]}</h2>
              {plan.prices ? (
                <p className="mt-3 text-2xl font-bold">
                  {locale === "vi" ? vnd(plan.prices.vnd.month) : usd(plan.prices.usd.month)}
                  <span className="text-sm font-normal text-muted-foreground"> {c.perMonth}</span>
                </p>
              ) : (
                <p className="mt-3 text-2xl font-bold">0</p>
              )}
              <a
                href={localePath(locale, "/dashboard/billing")}
                className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
              >
                {c.choosePlan}
              </a>
            </article>
          );
        })}
      </div>
    </Container>
  );
}
