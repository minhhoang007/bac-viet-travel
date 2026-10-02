import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/config/app";
import { getMarketingContent } from "@/content";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import { getPublicEnv } from "@/bootstrap/env";
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
import { ProductHomeSections } from "@/product/home";

type Props = { params: Promise<{ locale: Locale }> };

/** Anchors stay on the page; paths get the locale prefix. */
const heroHref = (locale: Locale, href: string) => (href.startsWith("#") ? href : localePath(locale, href));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getMarketingContent(locale);
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), {
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
