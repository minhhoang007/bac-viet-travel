import Image from "next/image";
import { BadgeCheck, CalendarDays, Car, Check, CreditCard, MapPin, MessageCircle, Star, Users } from "lucide-react";
import { submitContact } from "@/app/actions/contact";
import { loadBlog } from "@/app/_lib/blog";
import { getTours } from "@/app/_lib/tours";
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
import { DESTINATIONS, type Destination } from "./tours/catalog";
import { formatPrice } from "./tours/format";

const DESTINATION_IMAGE: Record<Destination, string> = {
  "ha-long": "/tours/halong-1.jpg",
  "ninh-binh": "/tours/ninhbinh-1.jpg",
  sapa: "/tours/sapa-1.jpg",
};
const TRUST_ICON = { license: BadgeCheck, pickup: Car, payment: CreditCard, support: MessageCircle } as const;

/** The starter's slot after its marketing blocks: unused, the whole page is ProductHomePage. */
export function ProductHomeSections({ locale }: { locale: Locale }) {
  void locale;
  return null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const field = "h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

function Stars({ label }: { label?: string }) {
  return (
    <span className="flex text-amber-500" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="size-4 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

/**
 * Bắc Việt home page (replaces the starter blocks): photo with a tour search, trust strip, destinations,
 * most booked tours, private tours, why us, reviews, travel guides, FAQ and the contact form (#contact).
 */
export async function ProductHomePage({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  const h = c.home;
  const m = getMarketingContent(locale);
  const catalog = await getTours();
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

      <section className="relative isolate overflow-hidden text-white" aria-labelledby="hero-title">
        <Image src={m.hero.image!.src} alt={m.hero.image!.alt} fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/40 to-black/70" />
        <Container className="grid gap-8 pb-10 pt-20 sm:pt-28 lg:pb-14">
          <div className="max-w-3xl">
            <p className="text-sm font-medium tracking-wide text-white/90">{m.hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-3 text-4xl font-semibold leading-tight [text-wrap:balance] sm:text-5xl">
              {m.hero.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">{m.hero.subtitle}</p>
          </div>

          <form
            action={localePath(locale, "/tours")}
            method="get"
            role="search"
            aria-label={h.search.title}
            data-testid="tour-search"
            className="grid gap-3 rounded-2xl bg-background p-4 text-foreground shadow-xl grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-end"
          >
            <label className="col-span-2 grid gap-1 text-sm font-medium lg:col-span-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4" aria-hidden="true" />
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
            <label className="grid gap-1 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden="true" />
                {h.search.date}
              </span>
              <input type="date" name="date" className={field} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4" aria-hidden="true" />
                {h.search.guests}
              </span>
              <input type="number" name="guests" min={1} max={50} defaultValue={2} className={field} />
            </label>
            <button type="submit" className="h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 col-span-2 lg:col-span-1">
              {h.search.submit}
            </button>
          </form>

          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-white lg:flex lg:flex-wrap lg:justify-between" data-testid="trust-strip">
            {h.trust.map((t) => {
              const Icon = TRUST_ICON[t.icon as keyof typeof TRUST_ICON];
              return (
                <li key={t.label} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {t.label}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section className="py-16" aria-labelledby="destinations-title">
        <Container>
          <h2 id="destinations-title" className="text-3xl font-semibold">
            {h.destinationsTitle}
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {DESTINATIONS.map((d) => (
              <a key={d} href={localePath(locale, `/tours/${d}`)} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl" data-destination-card={d}>
                <Image src={DESTINATION_IMAGE[d]} alt={c.destinations[d].name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <h3 className="text-2xl font-semibold">{c.destinations[d].name}</h3>
                  <p className="mt-2 text-sm text-white/90">{c.destinations[d].tagline}</p>
                </div>
              </a>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-muted py-16" aria-labelledby="featured-title">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured-title" className="text-3xl font-semibold">
              {h.featuredTitle}
            </h2>
            <a href={localePath(locale, "/tours")} className="text-sm font-medium text-primary underline underline-offset-4">
              {h.viewAll} →
            </a>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="py-16" aria-labelledby="private-title">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src="/tours/ninhbinh-2.jpg" alt={c.destinations["ninh-binh"].name} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">{h.private.eyebrow}</p>
            <h2 id="private-title" className="mt-2 text-3xl font-semibold [text-wrap:balance]">
              {h.private.title}
            </h2>
            <p className="mt-4 text-muted-foreground">{h.private.text}</p>
            <ul className="mt-5 grid gap-2">
              {h.private.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
            <ButtonLink href="#contact" className="mt-6">
              {h.private.cta}
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="bg-muted py-16" aria-labelledby="why-title">
        <Container>
          <h2 id="why-title" className="text-3xl font-semibold">
            {h.whyTitle}
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {h.why.map((w) => (
              <div key={w.title} className="border-t-2 border-primary pt-4">
                <h3 className="font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Sample reviews: data-demo makes `pnpm launch:check` fail until they are replaced by real ones. */}
      <section className="py-16" aria-labelledby="reviews-title" data-demo="reviews">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="reviews-title" className="text-3xl font-semibold">
                {h.reviewsTitle}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Stars />
                <strong className="text-foreground">{h.reviewsSummary.rating}</strong> {h.reviewsSummary.count}
              </p>
            </div>
            <p className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">{h.reviewsDemo}</p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {h.reviews.map((r) => (
              <figure key={r.name} className="flex flex-col rounded-2xl border border-border bg-background p-6" data-testid="review">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials(r.name)}
                  </span>
                  <figcaption className="text-sm">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="text-muted-foreground">
                      {r.origin} · {r.source}
                    </span>
                  </figcaption>
                </div>
                <div className="mt-4">
                  <Stars label="5/5" />
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed">“{r.text}”</blockquote>
                <p className="mt-4 text-xs text-muted-foreground">
                  {r.tour} · {r.date}
                </p>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      {posts.length > 0 && (
        <section className="bg-muted py-16" aria-labelledby="blog-title">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="blog-title" className="text-3xl font-semibold">
                {h.blogTitle}
              </h2>
              <a href={localePath(locale, "/blog")} className="text-sm font-medium text-primary underline underline-offset-4">
                {h.blogAll} →
              </a>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {posts.map((p) => (
                <a key={p.slug} href={localePath(locale, `/blog/${p.slug}`)} className="group flex flex-col overflow-hidden rounded-2xl bg-background" data-testid="home-post">
                  {p.cover && (
                    <div className="relative aspect-[16/9]">
                      <Image src={p.cover} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-semibold group-hover:underline">{p.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </Container>
        </section>
      )}

      <Faq id="faq" title={m.faq.title} items={m.faq.items} />

      <section id="contact" className="scroll-mt-20 bg-muted py-16" aria-labelledby="contact-title">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="contact-title" className="text-3xl font-semibold">
              {h.contactTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">{h.contactText}</p>
            <div className="mt-6 grid gap-2 text-sm">
              <a href={chat.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">
                {chat.label} →
              </a>
              <span>{contactConfig.hotline}</span>
              <span>{contactConfig.email}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-background p-6">{features.email ? <ContactForm action={submitContact} labels={m.contact} /> : null}</div>
        </Container>
      </section>
    </>
  );
}
