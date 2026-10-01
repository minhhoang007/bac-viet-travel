import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { getBooking } from "@/app/_lib/booking";
import { holdSeats } from "@/app/actions/booking";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingContent } from "@/product/booking/content";
import { BookingForm } from "@/product/components/booking-form";
import { getProductContent } from "@/product/content";
import { getTourCatalog } from "@/product/tours/catalog";

type Props = { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<{ d?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = getTourCatalog().get(locale, slug);
  return tour ? { title: getBookingContent(locale).pageTitle(tour.title), robots: { index: false } } : {};
}

/** Live seat counts: rendered per request. */
export default async function BookTourPage({ params, searchParams }: Props) {
  await connection();
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = getTourCatalog().get(locale, slug);
  if (!tour) notFound();
  const t = getBookingContent(locale);
  const departures = await getBooking().listDepartures(slug);
  const { d } = await searchParams;

  return (
    <Container className="py-10">
      <a href={localePath(locale, `/tours/${slug}`)} className="text-sm text-muted-foreground hover:underline">
        ← {tour.title}
      </a>
      <h1 className="mt-2 text-3xl font-bold">{t.pageTitle(tour.title)}</h1>
      <p className="mt-1 text-muted-foreground">
        {getProductContent(locale).tours.days(tour.days, tour.nights)} · {tour.departure}
      </p>
      <div className="mt-8">
        <BookingForm
          action={holdSeats}
          locale={locale}
          initialDepartureId={d}
          departures={departures.map((x) => ({ id: x.id, date: x.date, seatsLeft: x.seatsLeft, unitPriceVnd: x.unitPriceVnd, bookable: x.bookable, status: x.status }))}
        />
      </div>
    </Container>
  );
}
