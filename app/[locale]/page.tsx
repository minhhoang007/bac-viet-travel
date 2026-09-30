import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/config/app";
import { getMarketingContent } from "@/content";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import { getEnv } from "@/bootstrap/env";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getMarketingContent(locale);
  return createMetadata(seoSite(getEnv().NEXT_PUBLIC_SITE_URL), {
    title: c.meta.title,
    description: c.meta.description,
    path: "/",
    locale,
  });
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getMarketingContent(locale);

  return (
    <>
      <Hero
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primary={{ label: c.hero.primaryCta, href: "#contact" }}
        secondary={{ label: c.hero.secondaryCta, href: "#features" }}
      />
      <Features id="features" title={c.features.title} items={c.features.items} />
      <Faq id="faq" title={c.faq.title} items={c.faq.items} />
      <Cta id="contact" title={c.cta.title} subtitle={c.cta.subtitle} button={{ label: c.cta.button, href: "#contact" }} />
    </>
  );
}
