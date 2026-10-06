import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { contactConfig } from "@/config/contact";
import { getAboutContent } from "@/product/about";
import { getProductContent } from "@/product/content";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getAboutContent(locale);
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: c.title, description: c.description, path: "/about", locale, image: "/tours/ninhbinh-1.jpg" });
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getAboutContent(locale);
  const p = getProductContent(locale);
  const f = p.footer;
  const legal: [string, string][] = [
    [f.taxCode, contactConfig.taxCode],
    [f.representative, contactConfig.representative],
    [f.address, contactConfig.address],
    [f.hotline, contactConfig.hotline],
    ["Email", contactConfig.email],
    [f.hours, contactConfig.businessHours[locale]],
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden text-white">
        <Image src="/tours/ninhbinh-1.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/45 to-black/25" />
        <Container className="max-w-4xl pb-12 pt-24 sm:pt-32">
          <h1 className="text-4xl font-semibold [text-wrap:balance] sm:text-5xl">{c.title}</h1>
          <p className="mt-4 max-w-3xl text-lg text-white/90">{c.intro}</p>
        </Container>
      </section>

      <Container className="max-w-5xl py-14">
        <section className="grid items-center gap-10 md:grid-cols-2" aria-labelledby="about-story">
          <div>
            <h2 id="about-story" className="text-2xl font-semibold sm:text-3xl">
              {c.storyTitle}
            </h2>
            {c.story.map((s) => (
              <p key={s} className="mt-4 text-muted-foreground">
                {s}
              </p>
            ))}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src="/tours/halong-3.jpg" alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        </section>

        <section className="mt-16" aria-labelledby="about-why">
          <h2 id="about-why" className="text-2xl font-semibold sm:text-3xl">
            {c.whyTitle}
          </h2>
          <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {c.why.map((w) => (
              <li key={w.title} className="border-t-2 border-primary pt-4">
                <h3 className="font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{w.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Placeholder names until the company adds its real team and photos (product/about.ts). */}
        <section className="mt-16" aria-labelledby="about-team" data-demo="team">
          <h2 id="about-team" className="text-2xl font-semibold sm:text-3xl">
            {c.teamTitle}
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {c.team.map((m) => (
              <li key={m.name} className="flex items-center gap-4 rounded-2xl border border-border p-5">
                <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {initials(m.name)}
                </span>
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="text-sm text-muted-foreground">{m.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-[1.2fr_1fr]" aria-labelledby="about-legal">
          <div className="rounded-2xl border border-border p-6" data-testid="licence">
            <h2 id="about-legal" className="flex items-center gap-2 text-xl font-semibold">
              <BadgeCheck aria-hidden="true" className="size-6 text-primary" />
              {c.legalTitle}
            </h2>
            <p className="mt-4 font-medium">{contactConfig.legalName}</p>
            <p className="mt-1 text-sm">
              {contactConfig.licenseType[locale]}: <strong>{contactConfig.licenseNumber}</strong>
            </p>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {legal.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-2xl bg-muted p-6" aria-labelledby="about-partners">
            <h2 id="about-partners" className="text-xl font-semibold">
              {c.partnersTitle}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{c.partners}</p>
          </div>
        </section>

        <div className="mt-14 flex flex-wrap gap-3">
          <ButtonLink href={localePath(locale, "/tours")}>{c.cta}</ButtonLink>
          <ButtonLink href={localePath(locale, "/contact")} variant="outline">
            {c.contact}
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
