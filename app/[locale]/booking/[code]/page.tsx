import type { Metadata } from "next";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { getBooking } from "@/app/_lib/booking";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { formatDay, formatVnd, getBookingContent } from "@/product/booking/content";
import { HoldCountdown } from "@/product/components/hold-countdown";
import { getTourCatalog } from "@/product/tours/catalog";

type Props = { params: Promise<{ locale: Locale; code: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getBookingContent(locale).booking.title, robots: { index: false, follow: false } };
}

/** Private guest page: the secret token in the link is the only key (no login for guests). */
export default async function BookingPage({ params, searchParams }: Props) {
  await connection();
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = getBookingContent(locale);
  const { t: token } = await searchParams;
  const booking = token ? await getBooking().getForGuest(code, token) : null;

  if (!booking) {
    return (
      <Container className="max-w-2xl py-16">
        <h1 className="text-2xl font-bold">{t.booking.title}</h1>
        <p className="mt-4" data-booking="not-found">
          {t.booking.notFound}
        </p>
      </Container>
    );
  }

  const tour = getTourCatalog().get(locale, booking.departure.tourSlug);
  const status = booking.isExpired ? "expired" : booking.status;
  const rebook = localePath(locale, `/tours/${booking.departure.tourSlug}/book?d=${booking.departure.id}`);
  const guests = [booking.adults && `${booking.adults} ${t.adults.toLowerCase()}`, booking.children && `${booking.children} ${t.children.toLowerCase()}`, booking.infants && `${booking.infants} ${t.infants.toLowerCase()}`].filter(Boolean).join(", ");

  return (
    <Container className="max-w-2xl py-12">
      <h1 className="text-2xl font-bold">{t.booking.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.booking.code}: <strong className="font-mono text-base text-foreground" data-testid="booking-code">{booking.code}</strong> ·{" "}
        <span data-booking-status={status}>{t.booking.status[status]}</span>
      </p>

      {status === "held" && (
        <section className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold">{t.booking.heldTitle}</h2>
          <p className="mt-1 text-sm">{t.booking.heldText}</p>
          <p className="mt-4 text-sm">
            {t.booking.remaining}: <HoldCountdown expiresAt={booking.holdExpiresAt.toISOString()} />
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{t.booking.payNext}</p>
        </section>
      )}
      {status === "expired" && (
        <section className="mt-6 rounded-xl border border-border bg-muted p-5">
          <h2 className="text-lg font-semibold">{t.booking.expiredTitle}</h2>
          <p className="mt-1 text-sm">{t.booking.expiredText}</p>
          <ButtonLink href={rebook} className="mt-4">
            {t.booking.rebook}
          </ButtonLink>
        </section>
      )}

      <dl className="mt-8 grid gap-3 rounded-xl border border-border p-5 text-sm sm:grid-cols-[160px_1fr]">
        <dt className="text-muted-foreground">{t.booking.tour}</dt>
        <dd className="font-medium">{tour?.title ?? booking.departure.tourSlug}</dd>
        <dt className="text-muted-foreground">{t.booking.date}</dt>
        <dd className="font-medium capitalize">{formatDay(booking.departure.date, locale)}</dd>
        <dt className="text-muted-foreground">{t.booking.guests}</dt>
        <dd>{guests}</dd>
        <dt className="text-muted-foreground">{t.booking.contact}</dt>
        <dd>
          {booking.name} · {booking.email} · {booking.phone}
        </dd>
        <dt className="text-muted-foreground">{t.total}</dt>
        <dd className="font-semibold">{formatVnd(booking.totalVnd, locale)}</dd>
        <dt className="text-muted-foreground">{t.deposit}</dt>
        <dd className="font-bold text-primary" data-testid="booking-deposit">{formatVnd(booking.depositVnd, locale)}</dd>
      </dl>
    </Container>
  );
}
