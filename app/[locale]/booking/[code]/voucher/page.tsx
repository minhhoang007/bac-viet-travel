import type { Metadata } from "next";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { renderSVG } from "uqr";
import { getBooking } from "@/app/_lib/booking";
import { getTours } from "@/app/_lib/tours";
import { getPublicEnv } from "@/bootstrap/env";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { contactConfig } from "@/config/contact";
import { formatDay, formatVnd, getBookingContent } from "@/product/booking/content";
import { PrintButton } from "@/product/components/print-button";

type Props = { params: Promise<{ locale: Locale; code: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code } = await params;
  return { title: `${getBookingContent(locale).voucher.title} ${code}`, robots: { index: false, follow: false } };
}

/**
 * Printable voucher (D8) for a paid booking: the guest prints it or saves it as PDF from the browser. The QR opens
 * the booking in the staff admin (no secret in it); the guest's own link stays private.
 */
export default async function VoucherPage({ params, searchParams }: Props) {
  await connection();
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = getBookingContent(locale);
  const v = t.voucher;
  const { t: token } = await searchParams;
  const booking = token ? await getBooking().getForGuest(code, token) : null;
  if (!booking || (booking.status !== "deposit_paid" && booking.status !== "confirmed")) {
    return (
      <Container className="max-w-2xl py-16">
        <h1 className="text-2xl font-bold">{v.title}</h1>
        <p className="mt-4" data-voucher="unavailable">
          {v.unavailable}
        </p>
      </Container>
    );
  }
  const tour = (await getTours()).get(locale, booking.departure.tourSlug);
  const site = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const qr = renderSVG(`${site}${localePath("vi", `/admin/bookings/${booking.code}`)}`, { border: 1 });
  const back = localePath(locale, `/booking/${booking.code}?t=${encodeURIComponent(token!)}`);
  const ics = `/api/booking/${booking.code}/ics?t=${encodeURIComponent(token!)}&locale=${locale}`;
  const row = (label: string, value: React.ReactNode) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );

  return (
    <Container className="max-w-3xl py-10 print:max-w-none print:py-0">
      {/* Print only the voucher: no site header, footer or floating buttons. */}
      <style>{`@media print { header, footer, [data-contact-buttons], [data-print-hide] { display: none !important; } body { background: #fff; } }`}</style>
      <div data-print-hide className="mb-6 flex flex-wrap items-center gap-3">
        <a href={back} className="text-sm text-muted-foreground hover:underline">
          ← {v.back}
        </a>
        <PrintButton label={v.print} />
        <a href={ics} className="text-sm font-medium text-primary underline underline-offset-4" data-testid="voucher-ics">
          {v.addToCalendar}
        </a>
      </div>

      <article className="rounded-2xl border border-border p-6 print:border-black" data-testid="voucher">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4 print:!flex">
          <div>
            <p className="text-sm text-muted-foreground">{contactConfig.companyName}</p>
            <h1 className="text-2xl font-semibold">{v.title}</h1>
            <p className="mt-1 font-mono text-lg" data-testid="voucher-code">
              {booking.code}
            </p>
            <p className="mt-1 text-sm">{t.booking.status[booking.status]}</p>
          </div>
          <div role="img" aria-label={v.qrLabel(booking.code)} className="w-28 bg-white [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        </header>

        <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[150px_1fr]">
          {row(t.booking.tour, tour?.title ?? booking.departure.tourSlug)}
          {row(t.booking.date, <span className="capitalize">{formatDay(booking.departure.date, locale)}</span>)}
          {tour && row(v.pickup, tour.departure)}
          {row(t.booking.contact, `${booking.name} · ${booking.phone}`)}
          {row(t.total, formatVnd(booking.totalVnd, locale))}
          {row(v.paid, formatVnd(booking.depositVnd, locale))}
          {row(v.balance, booking.balancePaidAt ? t.booking.balancePaid : formatVnd(booking.totalVnd - booking.depositVnd, locale))}
        </dl>

        <section className="mt-5">
          <h2 className="font-semibold">{t.travellers.title}</h2>
          {booking.travellers.length ? (
            <ol className="mt-2 grid gap-1 text-sm" data-testid="voucher-travellers">
              {booking.travellers.map((p, i) => (
                <li key={i}>
                  {i + 1}. {p.name} ({p.birthYear})
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{t.travellers.missing}</p>
          )}
        </section>

        <footer className="mt-6 border-t border-border pt-4 text-sm print:!block">
          <p>{v.bring}</p>
          <p className="mt-1">
            {v.contact}: {contactConfig.hotline} · {contactConfig.email}
          </p>
        </footer>
      </article>
    </Container>
  );
}
