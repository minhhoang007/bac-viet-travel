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

/** Still image (poster, share image) per destination; a film where we have one, otherwise a slow zoom on the still. */
const DESTINATION_IMAGE: Record<Destination, string> = {
  "ha-long": "/video/hero-poster.jpg",
  "ninh-binh": "/video/ninhbinh-poster.jpg",
  sapa: "/tours/sapa-6.jpg",
};
// Demo films (Pexels) in public/video; real footage should move to a video CDN (bandwidth).
const DESTINATION_FILM: Partial<Record<Destination, { desktop: string; mobile: string }>> = {
  "ha-long": { desktop: "/video/hero-desktop.mp4", mobile: "/video/hero-mobile.mp4" },
  "ninh-binh": { desktop: "/video/ninhbinh-desktop.mp4", mobile: "/video/ninhbinh-mobile.mp4" },
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
  const film = DESTINATION_FILM[destination];
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.tours.destinationTitle(d.name),
    itemListElement: inDestination.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: localizedUrl(site, locale, `/tours/${t.slug}`), name: t.title })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([listLd, breadcrumbLd(site, locale, [{ path: "/tours", name: c.tours.title }, { path: `/tours/${destination}`, name: d.name }])]) }} />
      <section className="relative isolate flex min-h-[64svh] items-end overflow-hidden text-white" data-testid="destination-hero">
        <Image src={DESTINATION_IMAGE[destination]} alt={d.name} fill priority sizes="100vw" className={`-z-10 object-cover ${film ? "" : "animate-[kenburns_26s_ease-in-out_infinite_alternate] motion-reduce:animate-none"}`} />
        {film && (
          <video autoPlay muted loop playsInline preload="metadata" poster={DESTINATION_IMAGE[destination]} aria-hidden="true" className="absolute inset-0 -z-10 size-full object-cover motion-reduce:hidden" data-testid="destination-video">
            <source src={film.mobile} type="video/mp4" media="(max-width: 767px)" />
            <source src={film.desktop} type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-black/30 to-black/30" />
        <Container className="pb-12 pt-32 [text-shadow:0_1px_14px_rgb(0_0_0/0.55)] sm:pt-40">
          <a href={localePath(locale, "/tours")} className="type-label text-white/90 underline underline-offset-8">
            ← {c.tours.allDestinationsLink}
          </a>
          <h1 className="mt-5 font-heading type-display">{c.tours.destinationTitle(d.name)}</h1>
          <p className="mt-4 max-w-2xl type-lead text-white/90">{d.tagline}</p>
        </Container>
      </section>
      <Container className="py-10">
        <TourListingFromUrl locale={locale} tours={tours} destination={destination} />
      </Container>
    </>
  );
}
