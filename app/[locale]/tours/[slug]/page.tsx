import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { submitTourInquiry } from "@/app/actions/tour-inquiry";
import { Check, X } from "lucide-react";
import { MdxContent } from "@/components/blog/mdx";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata, localizedUrl, serializeJsonLd } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { contactConfig, whatsappUrl, zaloUrl } from "@/config/contact";
import { features } from "@/config/features";
import { formatVnd, getBookingContent } from "@/product/booking/content";
import { InquiryForm } from "@/product/components/inquiry-form";
import { TourCard } from "@/product/components/tour-card";
import { getProductContent } from "@/product/content";
import { getTourCatalog } from "@/product/tours/catalog";
import { formatPrice } from "@/product/tours/format";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

// Unknown slugs end in notFound() below (dynamicParams = false logs a NoFallbackError per 404).

export function generateStaticParams() {
  return getTourCatalog().slugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = getTourCatalog().get(locale, slug);
  if (!tour) return {};
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), {
    title: tour.title,
    description: tour.summary,
    path: `/tours/${slug}`,
    locale,
    image: tour.images[0],
  });
}

export default async function TourPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const catalog = getTourCatalog();
  const tour = catalog.get(locale, slug);
  if (!tour) notFound();
  const c = getProductContent(locale);
  const b = getBookingContent(locale);
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const url = localizedUrl(site, locale, `/tours/${slug}`);
  const price = formatPrice(tour, locale);
  const duration = c.tours.days(tour.days, tour.nights);
  const related = catalog.related(tour);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.summary,
    url,
    image: tour.images.map((i) => new URL(i, site.siteUrl).toString()),
    touristType: "Leisure",
    itinerary: {
      "@type": "ItemList",
      itemListElement: tour.itinerary.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: d.title, description: d.description })),
    },
    offers: {
      "@type": "Offer",
      price: locale === "vi" ? tour.price.vnd : tour.price.usd,
      priceCurrency: locale === "vi" ? "VND" : "USD",
      availability: "https://schema.org/InStock",
      url,
    },
    provider: { "@type": "TravelAgency", name: contactConfig.companyName, telephone: contactConfig.hotline },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="relative h-[42vh] min-h-72 w-full">
        <Image src={tour.images[0]!} alt={tour.title} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <Container className="absolute inset-x-0 bottom-0 pb-8 text-white">
          <a href={localePath(locale, `/tours#${tour.destination}`)} className="text-sm opacity-90 hover:underline">
            {c.destinations[tour.destination].name}
          </a>
          <h1 className="mt-1 max-w-3xl text-3xl font-bold sm:text-4xl">{tour.title}</h1>
          <p className="mt-2 text-sm opacity-90">
            {duration} · {c.tours.from} <strong className="text-lg">{price}</strong> {c.tours.perPerson}
          </p>
        </Container>
      </div>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <p className="text-lg">{tour.summary}</p>
          <dl className="mt-6 grid grid-cols-3 gap-4 rounded-lg border border-border p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{c.tours.duration}</dt>
              <dd className="font-medium">{duration}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{c.tours.departure}</dt>
              <dd className="font-medium">{tour.departure}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{c.tours.groupSize}</dt>
              <dd className="font-medium">{tour.groupSize}</dd>
            </div>
          </dl>

          <section className="mt-8">
            <h2 className="text-xl font-semibold">{c.tours.highlights}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {tour.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  {h}
                </li>
              ))}
            </ul>
          </section>

          {tour.body.trim() && (
            <div className="prose-blog mt-8">
              <MdxContent source={tour.body} />
            </div>
          )}

          {tour.images.length > 1 && (
            <Carousel className="mt-8" opts={{ loop: true }} aria-label={c.tours.gallery} data-testid="gallery">
              <CarouselContent>
                {tour.images.map((src, i) => (
                  <CarouselItem key={src} className="sm:basis-1/2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
                      <Image src={src} alt={`${tour.title} (${i + 1}/${tour.images.length})`} fill sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
          )}

          <section className="mt-10" data-testid="itinerary">
            <h2 className="text-xl font-semibold">{c.tours.itinerary}</h2>
            <ol className="mt-4 grid gap-4 border-l-2 border-primary/30 pl-6">
              {tour.itinerary.map((d, i) => (
                <li key={d.title} className="relative">
                  <span className="absolute -left-[2.1rem] flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="font-semibold">{c.tours.includes}</h2>
              <ul className="mt-2 grid gap-1 text-sm">
                {tour.includes.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    {x}
                  </li>
                ))}
              </ul>
            </section>
            {tour.excludes.length > 0 && (
              <section>
                <h2 className="font-semibold">{c.tours.excludes}</h2>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {tour.excludes.map((x) => (
                    <li key={x} className="flex gap-2">
                      <X aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">{c.tours.priceNote}</p>
        </div>

        <aside id="book" className="h-fit rounded-xl border border-border p-5 shadow-sm lg:sticky lg:top-6">
          <p className="text-sm text-muted-foreground">
            {c.tours.from} <span className="text-2xl font-bold text-primary">{price}</span> {c.tours.perPerson}
          </p>
          <ButtonLink href={localePath(locale, `/tours/${slug}/book`)} className="mt-3 w-full" data-testid="book-online">
            {b.cta}
          </ButtonLink>
          <p className="mt-1 text-xs text-muted-foreground">{b.ctaHint}</p>
          {tour.private && (
            <div className="mt-4 border-t border-border pt-4" data-testid="private-offer">
              <p className="text-sm font-medium">{b.privateFrom(formatVnd(tour.private.tiers.at(-1)!.vnd, locale))}</p>
              <p className="mt-1 text-xs text-muted-foreground">{b.privateHint}</p>
              <ButtonLink href={localePath(locale, `/tours/${slug}/book?type=private`)} variant="outline" className="mt-2 w-full">
                {b.privateCta}
              </ButtonLink>
            </div>
          )}
          <h2 className="mt-5 border-t border-border pt-4 text-lg font-semibold">{c.inquiry.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.inquiry.subtitle}</p>
          <div className="mt-4">
            {features.email ? (
              <InquiryForm action={submitTourInquiry} labels={c.inquiry} tour={tour.title} locale={locale} />
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <a href={whatsappUrl(c.contact.whatsappText(tour.title))} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#25d366] px-3 py-2 text-center font-medium text-[#052e16]">
              {c.contact.whatsapp}
            </a>
            <a href={zaloUrl()} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#0068ff] px-3 py-2 text-center font-medium text-white">
              {c.contact.zalo}
            </a>
          </div>
        </aside>
      </Container>

      {related.length > 0 && (
        <Container className="pb-16">
          <h2 className="text-2xl font-semibold">{c.tours.related}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => (
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
      )}
    </>
  );
}
