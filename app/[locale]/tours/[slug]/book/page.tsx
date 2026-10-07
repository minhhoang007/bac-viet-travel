import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { getBooking } from "@/app/_lib/booking";
import { holdPrivateSeats, holdSeats } from "@/app/actions/booking";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingContent } from "@/product/booking/content";
import { addDays, bookingRules, vietnamToday } from "@/product/booking/rules";
import { BookingForm } from "@/product/components/booking-form";
import { previewDiscount } from "@/app/actions/discounts";
import { BookingSteps } from "@/product/components/booking-steps";
import { getProductContent } from "@/product/content";
import { getTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<{ d?: string; type?: string; guests?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = (await getTours()).get(locale, slug);
  return tour ? { title: getBookingContent(locale).pageTitle(tour.title), robots: { index: false } } : {};
}

/** Live seat counts: rendered per request. */
export default async function BookTourPage({ params, searchParams }: Props) {
  await connection();
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = (await getTours()).get(locale, slug);
  if (!tour) notFound();
  const t = getBookingContent(locale);
  const { d, type, guests } = await searchParams;
  const adults = Number(guests);
  const isPrivate = type === "private" && Boolean(tour.private);
  const departures = isPrivate ? [] : await getBooking().listDepartures(slug);
  const today = vietnamToday(new Date());
  const tab = (active: boolean) => `rounded-full border px-4 py-1.5 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`;

  return (
    <Container className="py-10">
      <a href={localePath(locale, `/tours/${slug}`)} className="text-sm text-muted-foreground hover:underline">
        ← {tour.title}
      </a>
      <div className="mt-4 max-w-2xl">
        <BookingSteps locale={locale} current={1} />
      </div>
      <h1 className="mt-6 font-heading type-h2">{t.pageTitle(tour.title)}</h1>
      <p className="mt-1 text-muted-foreground">
        {getProductContent(locale).tours.days(tour.days, tour.nights)} · {tour.departure}
      </p>
      {tour.private && (
        <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label={t.modePrivate}>
          <a href={localePath(locale, `/tours/${slug}/book`)} aria-current={!isPrivate ? "page" : undefined} className={tab(!isPrivate)}>
            {t.modeGroup}
          </a>
          <a href={localePath(locale, `/tours/${slug}/book?type=private`)} aria-current={isPrivate ? "page" : undefined} className={tab(isPrivate)}>
            {t.modePrivate}
          </a>
          {isPrivate && <span className="text-sm text-muted-foreground">{t.privateHint}</span>}
        </nav>
      )}
      <div className="mt-8">
        <BookingForm
          key={isPrivate ? "private" : "group"}
          action={isPrivate ? holdPrivateSeats : holdSeats}
          locale={locale}
          privateTour={isPrivate ? { tourSlug: slug, pricing: tour.private!, minDate: addDays(today, bookingRules.cutoffDays), maxDate: addDays(today, 366) } : undefined}
          initialDepartureId={d}
          pricing={tour.pricing}
          tourSlug={slug}
          addons={tour.addons}
          previewDiscount={previewDiscount}
          tour={{ title: tour.title, image: tour.images[0]!, duration: getProductContent(locale).tours.days(tour.days, tour.nights) }}
          initialAdults={Number.isInteger(adults) && adults >= 1 && adults <= 50 ? adults : undefined}
          departures={departures.map((x) => ({ id: x.id, date: x.date, seatsLeft: x.seatsLeft, unitPriceVnd: x.unitPriceVnd, bookable: x.bookable, status: x.status }))}
        />
      </div>
    </Container>
  );
}
