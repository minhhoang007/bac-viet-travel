import Image from "next/image";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { serializeJsonLd } from "@/core/seo";
import type { Locale } from "@/config/app";
import { contactConfig } from "@/config/contact";
import { TourCard } from "./components/tour-card";
import { getProductContent } from "./content";
import { DESTINATIONS, type Destination } from "./tours/catalog";
import { getTours } from "@/app/_lib/tours";
import { formatPrice } from "./tours/format";

const DESTINATION_IMAGE: Record<Destination, string> = {
  "ha-long": "/tours/halong-1.jpg",
  "ninh-binh": "/tours/ninhbinh-1.jpg",
  sapa: "/tours/sapa-1.jpg",
};

/** Travel sections on the home page (after the starter's "how it works" block). */
export async function ProductHomeSections({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  const catalog = (await getTours());
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(agencyLd) }} />

      <section className="py-14" aria-labelledby="destinations-title">
        <Container>
          <h2 id="destinations-title" className="text-center text-3xl font-bold">
            {c.home.destinationsTitle}
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {DESTINATIONS.map((d) => (
              <a key={d} href={localePath(locale, `/tours#${d}`)} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl" data-destination-card={d}>
                <Image src={DESTINATION_IMAGE[d]} alt={c.destinations[d].name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <h3 className="text-2xl font-bold">{c.destinations[d].name}</h3>
                  <p className="mt-2 text-sm opacity-90">{c.destinations[d].tagline}</p>
                </div>
              </a>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-muted py-14" aria-labelledby="featured-title">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured-title" className="text-3xl font-bold">
              {c.home.featuredTitle}
            </h2>
            <a href={localePath(locale, "/tours")} className="text-sm font-medium text-primary hover:underline">
              {c.home.viewAll} →
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

      <section className="py-14" aria-labelledby="why-title">
        <Container>
          <h2 id="why-title" className="text-center text-3xl font-bold">
            {c.home.whyTitle}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.home.why.map((w) => (
              <div key={w.title} className="rounded-xl border border-border p-5">
                <h3 className="font-semibold text-primary">{w.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-muted py-14" aria-labelledby="reviews-title">
        <Container>
          <h2 id="reviews-title" className="text-center text-3xl font-bold">
            {c.home.reviewsTitle}
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {c.home.reviews.map((r) => (
              <figure key={r.name} className="rounded-xl bg-background p-6 shadow-sm">
                <p aria-hidden="true" className="text-amber-500">
                  ★★★★★
                </p>
                <blockquote className="mt-3 text-sm">“{r.text}”</blockquote>
                <figcaption className="mt-4 text-sm font-medium">{r.name}</figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
