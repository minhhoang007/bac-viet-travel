import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { contactConfig, whatsappUrl, zaloUrl } from "@/config/contact";
import { getAboutContent } from "@/product/about";
import { getProductContent } from "@/product/content";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getAboutContent(locale);
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: c.title, description: c.description, path: "/about", locale, image: "/tours/ninhbinh-1.jpg" });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getAboutContent(locale);
  const f = getProductContent(locale).footer;
  const legal: [string, string][] = [
    [f.taxCode, contactConfig.taxCode],
    [contactConfig.licenseType[locale], contactConfig.licenseNumber],
    [f.representative, contactConfig.representative],
    [f.address, contactConfig.address],
    [f.hotline, contactConfig.hotline],
    ["Email", contactConfig.email],
    [f.hours, contactConfig.businessHours[locale]],
  ];

  return (
    <Container className="max-w-4xl py-14">
      <h1 className="text-3xl font-bold md:text-4xl">{c.title}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{c.intro}</p>

      <section className="mt-12" aria-labelledby="about-story">
        <h2 id="about-story" className="text-2xl font-semibold">
          {c.storyTitle}
        </h2>
        {c.story.map((p) => (
          <p key={p} className="mt-3 text-muted-foreground">
            {p}
          </p>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="about-why">
        <h2 id="about-why" className="text-2xl font-semibold">
          {c.whyTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {c.why.map((w) => (
            <li key={w.title} className="rounded-xl border border-border p-5">
              <h3 className="font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{w.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="about-team">
        <h2 id="about-team" className="text-2xl font-semibold">
          {c.teamTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {c.team.map((m) => (
            <li key={m.name} className="rounded-xl border border-border p-5 text-center">
              <span aria-hidden="true" className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
                {m.name.split(" ").at(-1)?.charAt(0)}
              </span>
              <p className="mt-3 font-semibold">{m.name}</p>
              <p className="text-sm text-muted-foreground">{m.role}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="about-partners">
        <h2 id="about-partners" className="text-2xl font-semibold">
          {c.partnersTitle}
        </h2>
        <p className="mt-3 text-muted-foreground">{c.partners}</p>
      </section>

      <section className="mt-12 rounded-xl border border-border bg-muted/40 p-6" aria-labelledby="about-legal">
        <h2 id="about-legal" className="text-2xl font-semibold">
          {c.legalTitle}
        </h2>
        <p className="mt-3 font-medium">{contactConfig.legalName}</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {legal.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href={localePath(locale, "/tours")}>{c.cta}</ButtonLink>
        <ButtonLink href={locale === "vi" ? zaloUrl() : whatsappUrl()} variant="outline">
          {c.contact}
        </ButtonLink>
      </div>
    </Container>
  );
}
