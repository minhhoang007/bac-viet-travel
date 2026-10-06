import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { submitTourInquiry } from "@/app/actions/tour-inquiry";
import { CalendarDays, Check, Clock, Languages, MapPin, ShieldCheck, Users, X } from "lucide-react";
import { MarkdownContent } from "@/components/blog/markdown";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata, localizedUrl, serializeJsonLd } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { contactConfig, whatsappUrl, zaloUrl } from "@/config/contact";
import { features } from "@/config/features";
import { formatDay, formatVnd, getBookingContent } from "@/product/booking/content";
import { getBooking } from "@/app/_lib/booking";
import { getContainer } from "@/bootstrap/container";
import { TourGallery } from "@/product/components/tour-gallery";
import { InquiryForm } from "@/product/components/inquiry-form";
import { TourCard } from "@/product/components/tour-card";
import { getProductContent } from "@/product/content";
import { getTourPage, getTours } from "@/app/_lib/tours";
import { PreviewBanner } from "@/components/content/preview-banner";
import { Notice } from "@/components/feedback/notice";
import { getAppContent } from "@/content";
import { formatPrice } from "@/product/tours/format";
import { parseTourFilters } from "@/product/tours/filters";
import { isDestination } from "@/product/tours/model";
import { DestinationPage, destinationMetadata } from "../_destination";
import { getTourAdminContent, tourProblemLabel } from "@/product/tours/admin-content";

type Props = { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Rendered per request from published tours (CMS, cached); unknown slugs end in notFound() below.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (isDestination(slug)) return destinationMetadata(locale, slug);
  const page = await getTourPage(locale, slug);
  if (!page || !("tour" in page)) return {};
  const { tour } = page;
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), {
    title: tour.seoTitle ?? tour.title,
    description: tour.seoDescription ?? tour.summary,
    path: `/tours/${slug}`,
    locale,
    image: tour.images[0],
  });
}

export default async function TourPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  // Destination landing pages share the /tours/<slug> segment (tour slugs cannot be destination names).
  if (isDestination(slug)) {
    setRequestLocale(locale);
    return <DestinationPage locale={locale} destination={slug} tours={(await getTours()).list(locale)} filters={parseTourFilters(await searchParams)} />;
  }
  setRequestLocale(locale);
  const page = await getTourPage(locale, slug);
  if (!page) notFound();
  // An old URL of a renamed tour (permanent redirect keeps links and Google ranking).
  if ("moved" in page) permanentRedirect(localePath(locale, `/tours/${page.moved}`));
  const w = getAppContent(locale).admin.content;
  const banner = page.preview && <PreviewBanner label={w.previewing} exit={w.exitPreview} href={`/api/content/preview?exit=1&locale=${locale}`} />;
  if (!("tour" in page)) {
    return (
        <>
          {banner}
          <Container className="py-10">
            <Notice tone="warning" title={w.incomplete}>
              <ul className="list-disc pl-5">
                {page.problems.slice(0, 12).map((p) => (
                  <li key={p}>{tourProblemLabel(p, getTourAdminContent(locale))}</li>
                ))}
              </ul>
            </Notice>
          </Container>
        </>
    );
  }
  const { tour } = page;
  const catalog = await getTours();
  const c = getProductContent(locale);
  const b = getBookingContent(locale);
  const site = seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const url = localizedUrl(site, locale, `/tours/${slug}`);
  const price = formatPrice(tour, locale);
  const duration = c.tours.days(tour.days, tour.nights);
  const related = catalog.related(tour);
  // Date and group size chosen in the search (or the tour list) preselect the departure on the booking page.
  const trip = parseTourFilters(await searchParams);
  const departures = page.preview
    ? []
    : await getBooking()
        .listDepartures(slug)
        .catch((error: unknown) => {
          getContainer().logger.error("tours.departures_failed", { slug, error });
          return [];
        });
  const chosen = trip.date ? departures.find((d) => d.date === trip.date && d.bookable) : undefined;
  const bookHref = (departureId?: string) => {
    const q = new URLSearchParams();
    if (departureId) q.set("d", departureId);
    if (trip.guests) q.set("guests", String(trip.guests));
    const qs = q.toString();
    return `${localePath(locale, `/tours/${slug}/book`)}${qs ? `?${qs}` : ""}`;
  };
  const upcoming = departures.slice(0, 8);
  const seatLabel = (d: (typeof departures)[number]) => (d.bookable ? b.seatsLeft(d.seatsLeft) : d.status === "closed" ? b.closed : d.seatsLeft <= 0 ? b.soldOut : b.tooSoon);
  const facts = [
    { icon: Clock, label: c.tours.duration, value: duration },
    { icon: MapPin, label: c.tours.departure, value: tour.departure },
    { icon: Users, label: c.tours.groupSize, value: tour.groupSize },
    { icon: Languages, label: c.tours.languages, value: c.tours.languagesValue },
  ];

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
      {banner}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Container className="pt-6 lg:pt-10">
        <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
          <a href={localePath(locale, "/tours")} className="hover:underline">
            {c.tours.title}
          </a>
          {" / "}
          <a href={localePath(locale, `/tours/${tour.destination}`)} className="hover:underline">
            {c.destinations[tour.destination].name}
          </a>
        </nav>
        <h1 className="mt-2 max-w-4xl text-3xl font-semibold [text-wrap:balance] sm:text-4xl">{tour.title}</h1>
        <div className="mt-6">
          <TourGallery images={tour.images} title={tour.title} locale={locale} />
        </div>
      </Container>

      <Container className="grid gap-10 pb-28 pt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-16">
        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border p-4 text-sm sm:grid-cols-4" data-testid="tour-facts">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  {label}
                </dt>
                <dd className="mt-0.5 font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 text-lg">{tour.summary}</p>

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

          {!page.preview && (
            <section id="departures" className="mt-10 scroll-mt-24" aria-labelledby="departures-title" data-testid="tour-departures">
              <h2 id="departures-title" className="text-xl font-semibold">
                {c.tours.departuresTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.tours.departuresHint}</p>
              {upcoming.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{b.noDepartures}</p>
              ) : (
                <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
                  {upcoming.map((d) => (
                    <li key={d.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${chosen?.id === d.id ? "bg-primary/5" : ""}`} data-departure={d.date} aria-current={chosen?.id === d.id ? "true" : undefined}>
                      <div className="flex items-center gap-3">
                        <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">{formatDay(d.date, locale)}</p>
                          <p className={`text-xs ${d.bookable && d.seatsLeft <= 5 ? "font-medium text-warning" : "text-muted-foreground"}`}>{seatLabel(d)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{locale === "vi" ? formatVnd(d.unitPriceVnd, locale) : formatPrice({ price: { vnd: d.unitPriceVnd, usd: Math.round((tour.price.usd * d.unitPriceVnd) / tour.price.vnd) } }, locale)}</span>
                        {d.bookable ? (
                          <ButtonLink href={bookHref(d.id)} className="h-9 px-4" variant={chosen?.id === d.id ? "primary" : "outline"} aria-label={c.tours.chooseDay(formatDay(d.date, locale))}>
                            {b.choose}
                          </ButtonLink>
                        ) : (
                          <span className="w-16 text-center text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {departures.length > upcoming.length && (
                <a href={bookHref(chosen?.id)} className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4">
                  {c.tours.departuresAll} →
                </a>
              )}
            </section>
          )}

          {tour.body.trim() && (
            <div className="prose-blog mt-10">
              <MarkdownContent source={tour.body} />
            </div>
          )}

          <section className="mt-10" data-testid="itinerary">
            <h2 className="text-xl font-semibold">{c.tours.itinerary}</h2>
            <ol className="mt-4 grid gap-3">
              {tour.itinerary.map((d, i) => (
                <li key={d.title}>
                  <details open={i === 0} className="group rounded-xl border border-border px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold">
                      <span className="flex h-7 shrink-0 items-center rounded-full bg-primary px-2.5 text-xs font-bold text-primary-foreground">{c.tours.itineraryDay(i + 1)}</span>
                      <span className="flex-1">{d.title}</span>
                      <span aria-hidden="true" className="text-lg text-muted-foreground transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
                  </details>
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

        <aside id="book" className="h-fit rounded-2xl border border-border p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm text-muted-foreground">
            {c.tours.from} <span className="text-2xl font-bold text-primary">{price}</span> {c.tours.perPerson}
          </p>
          {page.preview ? (
            <p className="mt-3 rounded-md bg-muted p-3 text-sm" data-testid="preview-no-booking">
              {getTourAdminContent(locale).previewNoBooking}
            </p>
          ) : (
            <>
              <ButtonLink href={bookHref(chosen?.id)} className="mt-3 w-full" data-testid="book-online">
                {chosen ? c.tours.bookDate(formatDay(chosen.date, locale)) : c.tours.chooseDate}
              </ButtonLink>
              <ul className="mt-4 grid gap-1.5 text-xs text-muted-foreground" data-testid="booking-trust">
                {c.tours.trust.map((t) => (
                  <li key={t} className="flex gap-2">
                    <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
              {tour.private && (
                <div className="mt-4 border-t border-border pt-4" data-testid="private-offer">
                  <p className="text-sm font-medium">{b.privateFrom(formatVnd(tour.private.tiers.at(-1)!.vnd, locale))}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{b.privateHint}</p>
                  <ButtonLink href={localePath(locale, `/tours/${slug}/book?type=private`)} variant="outline" className="mt-2 w-full">
                    {b.privateCta}
                  </ButtonLink>
                </div>
              )}
              {features.email && (
                <details className="mt-4 border-t border-border pt-4" data-testid="inquiry">
                  <summary className="cursor-pointer text-sm font-medium">{c.tours.askAdvice}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{c.inquiry.subtitle}</p>
                  <div className="mt-4">
                    <InquiryForm action={submitTourInquiry} labels={c.inquiry} tour={tour.title} locale={locale} />
                  </div>
                </details>
              )}
            </>
          )}
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

      {!page.preview && (
        <div data-mobile-book-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <p className="text-sm leading-tight">
              <span className="text-muted-foreground">{c.tours.from}</span> <span className="text-lg font-bold text-primary">{price}</span>
              <span className="block text-xs text-muted-foreground">{c.tours.perPerson}</span>
            </p>
            <ButtonLink href={bookHref(chosen?.id)} data-testid="mobile-book">
              {c.tours.chooseDate}
            </ButtonLink>
          </div>
        </div>
      )}

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
