import type { Metadata } from "next";
import Image from "next/image";
import { getPublicEnv } from "@/bootstrap/env";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata, serializeJsonLd, localizedUrl } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { TourListingFromUrl } from "@/product/components/tour-listing-url";
import { getProductContent } from "@/product/content";
import { breadcrumbLd } from "@/product/seo";
import type { Destination, Tour } from "@/product/tours/model";

const DESTINATION_IMAGE: Record<Destination, string> = {
  "ha-long": "/tours/halong-2.jpg",
  "ninh-binh": "/tours/ninhbinh-3.jpg",
  sapa: "/tours/sapa-2.jpg",
};

export function destinationMetadata(locale: Locale, destination: Destination): Metadata {
  const c = getProductContent(locale);
  const name = c.destinations[destination].name;
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), {
    title: c.tours.destinationTitle(name),
    description: c.destinations[destination].tagline,
    path: `/tours/${destination}`,
    locale,
    image: DESTINATION_IMAGE[destination],
  });
}

/** /tours/ha-long, /tours/ninh-binh, /tours/sapa: one landing page per destination (SEO), with the same filters. */
export function DestinationPage({ locale, destination, tours }: { locale: Locale; destination: Destination; tours: Tour[] }) {
  const c = getProductContent(locale);
  const d = c.destinations[destination];
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const inDestination = tours.filter((t) => t.destination === destination);
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.tours.destinationTitle(d.name),
    itemListElement: inDestination.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: localizedUrl(site, locale, `/tours/${t.slug}`), name: t.title })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([listLd, breadcrumbLd(site, locale, [{ path: "/tours", name: c.tours.title }, { path: `/tours/${destination}`, name: d.name }])]) }} />
      <section className="relative isolate overflow-hidden text-white">
        <Image src={DESTINATION_IMAGE[destination]} alt={d.name} fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/20" />
        <Container className="pb-10 pt-24 sm:pt-32">
          <a href={localePath(locale, "/tours")} className="text-sm text-white/90 underline underline-offset-4">
            ← {c.tours.allDestinationsLink}
          </a>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{c.tours.destinationTitle(d.name)}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/90">{d.tagline}</p>
        </Container>
      </section>
      <Container className="py-10">
        <TourListingFromUrl locale={locale} tours={tours} destination={destination} />
      </Container>
    </>
  );
}
