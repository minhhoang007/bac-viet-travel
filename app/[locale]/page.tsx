import { getSeoSite } from "@/bootstrap/seo";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/config/app";
import { getMarketingContent } from "@/content";
import { localePath, routing } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { ContactForm } from "@/components/marketing/contact-form";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { Steps } from "@/components/marketing/steps";
import { Testimonials } from "@/components/marketing/testimonials";
import { Pricing } from "@/components/marketing/pricing";
import { features } from "@/config/features";
import { submitContact } from "@/app/actions/contact";
import * as productHome from "@/product/home";
import { ProductHomeSections } from "@/product/home";

// Optional project home page (product/home.tsx `ProductHomePage`) replacing every starter block below the metadata.
const ProductHomePage = "ProductHomePage" in productHome ? (productHome as { ProductHomePage?: (p: { locale: Locale }) => Promise<ReactNode> | ReactNode }).ProductHomePage : undefined;

type Props = { params: Promise<{ locale: Locale }> };

// Static, served from the CDN. Project sections that read cached data (tags) are regenerated when it changes;
// hourly revalidation is the safety net.
export const revalidate = 3600;

/** Anchors stay on the page; paths get the locale prefix. */
/**
 * Paths with a dot skip proxy.ts, so /favicon.ico or /x.txt arrive here as the "locale". The layout's notFound()
 * renders in parallel with this page, so the page checks too (otherwise: no content for that locale → 500).
 */
function knownLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

const heroHref = (locale: Locale, href: string) => (href.startsWith("#") ? href : localePath(locale, href));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = knownLocale((await params).locale);
  const c = getMarketingContent(locale);
  return createMetadata(getSeoSite(), {
    title: c.meta.title,
    description: c.meta.description,
    path: "/",
    locale,
  });
}

export default async function HomePage({ params }: Props) {
  const locale = knownLocale((await params).locale);
  setRequestLocale(locale);
  if (ProductHomePage) return <ProductHomePage locale={locale} />;
  const c = getMarketingContent(locale);

  return (
    <>
      <Hero
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primary={{ label: c.hero.primaryCta, href: heroHref(locale, c.hero.primaryHref) }}
        secondary={{ label: c.hero.secondaryCta, href: heroHref(locale, c.hero.secondaryHref) }}
        image={c.hero.image}
      />
      {c.logos && <LogoCloud title={c.logos.title} items={c.logos.items} />}
      {c.problemSolution && <ProblemSolution id="why" {...c.problemSolution} />}
      <Features id="features" title={c.features.title} items={c.features.items} />
      {c.steps && <Steps id="how-it-works" title={c.steps.title} items={c.steps.items} />}
      <ProductHomeSections locale={locale} />
      {c.testimonials && <Testimonials id="testimonials" title={c.testimonials.title} items={c.testimonials.items} />}
      {c.pricing && (
        <Pricing
          id="pricing"
          title={c.pricing.title}
          subtitle={c.pricing.subtitle}
          plans={c.pricing.plans.map((plan) => ({ ...plan, cta: { ...plan.cta, href: heroHref(locale, plan.cta.href) } }))}
        />
      )}
      <Faq id="faq" title={c.faq.title} items={c.faq.items} />
      <Cta id="contact" title={c.cta.title} subtitle={c.cta.subtitle} button={{ label: c.cta.button, href: "#contact" }}>
        {features.email ? <ContactForm action={submitContact} labels={c.contact} /> : null}
      </Cta>
    </>
  );
}
