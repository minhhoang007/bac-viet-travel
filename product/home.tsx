import Form from "next/form";
import { IntentLink } from "./components/intent-link";
import Image from "next/image";
import { BadgeCheck, CalendarDays, Car, CreditCard, MapPin, MessageCircle, Star, Users } from "lucide-react";
import { submitContact } from "@/app/actions/contact";
import { loadBlog } from "@/app/_lib/blog";
import { getPublicTours } from "@/app/_lib/tours";
import { ContactForm } from "@/components/marketing/contact-form";
import { Faq } from "@/components/marketing/faq";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { serializeJsonLd } from "@/core/seo";
import type { Locale } from "@/config/app";
import { contactConfig, whatsappUrl, zaloUrl } from "@/config/contact";
import { features } from "@/config/features";
import { getMarketingContent } from "@/content";
import { TourCard } from "./components/tour-card";
import { getProductContent } from "./content";
import { DESTINATIONS } from "./tours/catalog";
import { formatPrice } from "./tours/format";
import { DESTINATION_PHOTO } from "./tours/photos";

const TRUST_ICON = { license: BadgeCheck, pickup: Car, payment: CreditCard, support: MessageCircle } as const;
const ROMAN = ["I.", "II.", "III.", "IV.", "V."];

/** The starter's slot after its marketing blocks: unused, the whole page is ProductHomePage. */
export function ProductHomeSections({ locale }: { locale: Locale }) {
  void locale;
  return null;
}

// 16 px on phones: iOS Safari zooms into smaller fields on focus.
const field = "h-11 w-full border border-border bg-transparent px-3 text-base text-foreground md:text-sm";
/** Small spaced capitals above a section title, in brass. */
const eyebrow = "type-eyebrow text-primary";
const title = "font-heading type-h2";
const textLink = "type-label underline underline-offset-8 hover:text-primary";

function Stars({ label }: { label?: string }) {
  return (
    <span className="flex text-primary" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="size-3.5 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

/**
 * Bắc Việt home page, "Sơn Mài" direction (dark, cinematic, editorial): full-height photo with the tour search,
 * philosophy, destinations as chapters, private journeys, most booked tours, reviews, travel notes, FAQ and the
 * contact form (#contact).
 */
export async function ProductHomePage({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  const h = c.home;
  const m = getMarketingContent(locale);
  const catalog = await getPublicTours();
  const posts = (await loadBlog())?.list(locale).slice(0, 3) ?? [];
  const agencyLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: contactConfig.companyName,
    legalName: contactConfig.legalName,
    taxID: contactConfig.taxCode,
    telephone: contactConfig.hotline,
    email: contactConfig.email,
    address: { "@type": "PostalAddress", streetAddress: contactConfig.address, addressLocality: contactConfig.city, addressCountry: "VN" },
    areaServed: DESTINATIONS.map((d) => c.destinations[d].name),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: m.faq.items.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
  };
  const chat = locale === "vi" ? { href: zaloUrl(), label: c.contact.zalo } : { href: whatsappUrl(), label: c.contact.whatsapp };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(agencyLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }} />

      {/* Hero: the photo fills the screen; the text sits low and centred, the search bar under it. */}
      <section className="relative isolate flex min-h-[88svh] items-end overflow-hidden text-[#f5f1ea]" aria-labelledby="hero-title">
        <Image src={m.hero.image!.src} alt={m.hero.image!.alt} fill priority sizes="100vw" className="-z-10 object-cover" />
        {/*
          Background film: 10 s, muted, no controls; the poster (same first frame) is the LCP image. Phones get a lighter
          portrait cut. Hidden for visitors who ask for reduced motion: they keep the still photo.
          Demo files in public/video (Pexels); real footage should move to a video CDN (bandwidth).
        */}
        <video autoPlay muted loop playsInline preload="metadata" poster={m.hero.image!.src} aria-hidden="true" className="absolute inset-0 -z-10 size-full object-cover motion-reduce:hidden" data-testid="hero-video">
          <source src="/video/hero-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/video/hero-desktop.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/20 to-background" />
        <Container className="grid gap-10 pb-12 pt-32 text-center">
          <div className="home-hero-text mx-auto max-w-4xl [text-shadow:0_1px_14px_rgb(0_0_0/0.55)]">
            <p className="type-eyebrow opacity-90">{m.hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-5 font-heading type-display">
              {m.hero.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl type-lead font-light opacity-90 [text-wrap:balance]">{m.hero.subtitle}</p>
            <div className="home-hero-actions mt-9 flex flex-wrap items-center justify-center gap-6">
              <ButtonLink href={localePath(locale, m.hero.primaryHref)} className="type-label h-12 px-8">
                {m.hero.primaryCta}
              </ButtonLink>
              <a href={m.hero.secondaryHref} className="type-label underline underline-offset-8">
                {m.hero.secondaryCta}
              </a>
            </div>
          </div>

          <Form
            action={localePath(locale, "/tours")}
            role="search"
            aria-label={h.search.title}
            data-testid="tour-search"
            className="grid grid-cols-2 gap-3 border border-border bg-background/85 p-4 text-left text-foreground backdrop-blur lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-end"
          >
            <label className="col-span-2 grid gap-1.5 lg:col-span-1">
              <span className="type-label flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" />
                {h.search.destination}
              </span>
              <select name="destination" className={field} defaultValue="">
                <option value="">{h.search.anyDestination}</option>
                {DESTINATIONS.map((d) => (
                  <option key={d} value={d}>
                    {c.destinations[d].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="type-label flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {h.search.date}
              </span>
              <input type="date" name="date" className={field} />
            </label>
            <label className="grid gap-1.5">
              <span className="type-label flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                {h.search.guests}
              </span>
              <input type="number" name="guests" min={1} max={50} defaultValue={2} className={field} />
            </label>
            <button type="submit" className="type-label col-span-2 h-11 bg-primary px-7 text-primary-foreground hover:bg-primary/90 lg:col-span-1">
              {h.search.submit}
            </button>
          </Form>

          <ul className="type-small grid grid-cols-2 gap-x-4 gap-y-3 text-left text-muted-foreground lg:flex lg:flex-wrap lg:justify-between" data-testid="trust-strip">
            {h.trust.map((t) => {
              const Icon = TRUST_ICON[t.icon as keyof typeof TRUST_ICON];
              return (
                <li key={t.label} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t.label}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Philosophy: one sentence in the heading serif, then the promises as numbered pillars. */}
      <section className="py-28 sm:py-36" aria-labelledby="philosophy-title">
        <Container>
          <p className={eyebrow}>{h.philosophy.eyebrow}</p>
          <h2 id="philosophy-title" className="mt-6 max-w-4xl font-heading type-h2">
            {h.philosophy.statement}
          </h2>
          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-border pt-10 sm:mt-20 sm:pt-12 lg:grid-cols-4 lg:gap-12">
            {h.why.map((w, i) => (
              <div key={w.title}>
                <p className="font-heading type-h3 text-primary">{ROMAN[i]}</p>
                <h3 className="mt-3 font-sans text-lg font-medium">{w.title}</h3>
                <p className="mt-2 type-body text-muted-foreground">{w.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Destinations as chapters; the middle one sits lower on wide screens. */}
      <section className="pb-28" aria-labelledby="destinations-title">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={eyebrow}>{h.eyebrows.destinations}</p>
              <h2 id="destinations-title" className={`mt-5 ${title}`}>
                {h.destinationsTitle}
              </h2>
            </div>
            <IntentLink href={localePath(locale, "/tours")} className={textLink}>
              {h.viewAll}
            </IntentLink>
          </div>
          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
            {DESTINATIONS.map((d, i) => (
              <IntentLink key={d} href={localePath(locale, `/tours/${d}`)} className={`group block ${i === 1 ? "md:mt-24" : ""}`} data-destination-card={d}>
                <div className="relative aspect-[4/3] overflow-hidden md:aspect-[4/5]">
                  <Image src={DESTINATION_PHOTO[d]} alt={c.destinations[d].name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover saturate-[.88] transition duration-700 group-hover:scale-[1.03]" />
                </div>
                <p className="mt-6 type-eyebrow text-primary">{h.chapter(i + 1)}</p>
                <h3 className="mt-2 font-heading type-h2">{c.destinations[d].name}</h3>
                <p className="mt-3 type-body text-muted-foreground">{c.destinations[d].tagline}</p>
              </IntentLink>
            ))}
          </div>
        </Container>
      </section>

      {/* Private journeys: the photo bleeds to the edge, the text sits beside it. */}
      <section className="bg-muted" aria-labelledby="private-title">
        <div className="grid items-center lg:grid-cols-2">
          <div className="relative min-h-[420px] lg:min-h-[680px]">
            <Image src="/tours/ninhbinh-3.jpg" alt={c.destinations["ninh-binh"].name} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover saturate-[.88]" />
          </div>
          <div className="px-4 py-20 sm:px-10 lg:px-20">
            <p className={eyebrow}>{h.private.eyebrow}</p>
            <h2 id="private-title" className={`mt-6 ${title}`}>
              {h.private.title}
            </h2>
            <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">{h.private.text}</p>
            <ul className="mt-8 grid max-w-xl gap-3 border-t border-border pt-6">
              {h.private.points.map((p) => (
                <li key={p} className="type-body flex items-start gap-4">
                  <span className="mt-2.5 h-px w-5 shrink-0 bg-primary" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
            <ButtonLink href="#contact" className="type-label mt-10 h-12 px-8">
              {h.private.cta}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="py-28" aria-labelledby="featured-title">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={eyebrow}>{h.eyebrows.featured}</p>
              <h2 id="featured-title" className={`mt-5 ${title}`}>
                {h.featuredTitle}
              </h2>
            </div>
            <IntentLink href={localePath(locale, "/tours")} className={textLink}>
              {h.viewAll}
            </IntentLink>
          </div>
          <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.featured(locale).map((t) => (
              <TourCard
                key={t.slug}
                href={localePath(locale, `/tours/${t.slug}`)}
                image={t.images[0]!}
                title={t.title}
                summary={t.summary}
                duration={c.tours.days(t.days, t.nights)}
                destination={c.destinations[t.destination].name}
                price={formatPrice(t, locale)}
                fromLabel={c.tours.from}
                perPersonLabel={c.tours.perPerson}
              />
            ))}
          </div>
        </Container>
      </section>

      {/* Sample reviews: data-demo makes `pnpm launch:check` fail until they are replaced by real ones. */}
      <section className="border-y border-border py-28" aria-labelledby="reviews-title" data-demo="reviews">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={eyebrow}>{h.eyebrows.reviews}</p>
              <h2 id="reviews-title" className={`mt-5 ${title}`}>
                {h.reviewsTitle}
              </h2>
              <p className="mt-4 type-small flex items-center gap-2 text-muted-foreground">
                <Stars />
                <strong className="font-medium text-foreground">{h.reviewsSummary.rating}</strong> {h.reviewsSummary.count}
              </p>
            </div>
            <p className="type-small border border-dashed border-border px-3 py-1 text-muted-foreground">{h.reviewsDemo}</p>
          </div>
          <div className="mt-14 grid gap-12 md:grid-cols-3">
            {h.reviews.map((r) => (
              <figure key={r.name} className="flex flex-col border-t border-border pt-6" data-testid="review">
                <Stars label="5/5" />
                <blockquote className="mt-5 flex-1 font-heading text-[1.375rem] italic leading-normal">“{r.text}”</blockquote>
                <figcaption className="type-label mt-6 text-muted-foreground">
                  <span className="block text-foreground">{r.name}</span>
                  <span className="mt-1 block">
                    {r.origin} · {r.source} · {r.date}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      {posts.length > 0 && (
        <section className="py-28" aria-labelledby="blog-title">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className={eyebrow}>{h.eyebrows.blog}</p>
                <h2 id="blog-title" className={`mt-5 ${title}`}>
                  {h.blogTitle}
                </h2>
              </div>
              <IntentLink href={localePath(locale, "/blog")} className={textLink}>
                {h.blogAll}
              </IntentLink>
            </div>
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {posts.map((p) => (
                <IntentLink key={p.slug} href={localePath(locale, `/blog/${p.slug}`)} className="group flex flex-col border-t border-border pt-5" data-testid="home-post">
                  {p.cover && (
                    <div className="relative aspect-[3/2] overflow-hidden">
                      <Image src={p.cover} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
                    </div>
                  )}
                  <h3 className="mt-5 font-heading type-h3 group-hover:text-primary">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 type-body text-muted-foreground">{p.description}</p>
                </IntentLink>
              ))}
            </div>
          </Container>
        </section>
      )}

      <Faq id="faq" title={m.faq.title} items={m.faq.items} />

      <section id="contact" className="scroll-mt-20 bg-muted py-28" aria-labelledby="contact-title">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className={eyebrow}>{h.eyebrows.contact}</p>
            <h2 id="contact-title" className={`mt-5 ${title}`}>
              {h.contactTitle}
            </h2>
            <p className="mt-6 leading-relaxed text-muted-foreground">{h.contactText}</p>
            <div className="mt-8 grid gap-2 type-body">
              <a href={chat.href} target="_blank" rel="noopener noreferrer" className={`w-fit ${textLink}`}>
                {chat.label}
              </a>
              <span className="mt-2">{contactConfig.hotline}</span>
              <span>{contactConfig.email}</span>
            </div>
          </div>
          <div className="border border-border bg-background p-6 sm:p-8">{features.email ? <ContactForm action={submitContact} labels={m.contact} /> : null}</div>
        </Container>
      </section>
    </>
  );
}
