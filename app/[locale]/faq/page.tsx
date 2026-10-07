import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata, serializeJsonLd } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { getProductContent } from "@/product/content";
import { getFaq } from "@/product/faq";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getProductContent(locale).faqPage;
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: c.title, description: c.description, path: "/faq", locale });
}

/** Questions guests ask before booking (E5), with FAQPage structured data. Static. */
export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getProductContent(locale).faqPage;
  const groups = getFaq(locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) => g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } }))),
  };

  return (
    <Container className="max-w-3xl py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <h1 className="font-heading type-h1">{c.title}</h1>
      <p className="mt-2 text-muted-foreground">{c.description}</p>
      {groups.map((g) => (
        <section key={g.title} className="mt-10" aria-labelledby={`faq-${g.title}`}>
          <h2 id={`faq-${g.title}`} className="font-heading type-h3">
            {g.title}
          </h2>
          <div className="mt-3 divide-y divide-border border border-border" data-testid="faq-group">
            {g.items.map((i) => (
              <details key={i.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  {i.q}
                  <span aria-hidden="true" className="text-lg text-muted-foreground transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-prose type-body text-muted-foreground">{i.a}</p>
                {i.link && (
                  <a href={localePath(locale, i.link.href)} className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4">
                    {i.link.label} →
                  </a>
                )}
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="mt-10 bg-muted p-5 type-body">
        {c.more}{" "}
        <a href={localePath(locale, "/contact")} className="font-medium text-primary underline underline-offset-4">
          {c.contact}
        </a>
      </p>
    </Container>
  );
}
