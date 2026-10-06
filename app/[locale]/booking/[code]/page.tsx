import type { Metadata } from "next";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { getBooking, isPaymentsSandbox } from "@/app/_lib/booking";
import { startDeposit } from "@/app/actions/booking";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { formatDay, formatVnd, getBookingContent } from "@/product/booking/content";
import { AutoRefresh } from "@/product/components/auto-refresh";
import { DepositButton } from "@/product/components/deposit-button";
import { HoldCountdown } from "@/product/components/hold-countdown";
import { BookingSteps } from "@/product/components/booking-steps";
import { contactConfig, telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { getTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale; code: string }>; searchParams: Promise<{ t?: string; pay?: string }> };

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
  const { t: token, pay } = await searchParams;
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

  const tour = (await getTours()).get(locale, booking.departure.tourSlug);
  const status = booking.isExpired ? "expired" : booking.status;
  const sandbox = isPaymentsSandbox();
  // Back from VNPay with a success code, but the IPN has not arrived yet.
  const confirming = status === "held" && pay === "pending";
  const rebook = localePath(locale, `/tours/${booking.departure.tourSlug}/book?d=${booking.departure.id}`);
  const step = status === "held" ? 2 : status === "deposit_paid" || status === "confirmed" ? 3 : null;
  const next = status === "held" ? t.booking.nextHeld : status === "deposit_paid" || status === "confirmed" ? t.booking.nextPaid : null;
  const chat = locale === "vi" ? { href: zaloUrl(), label: "Zalo" } : { href: whatsappUrl(), label: "WhatsApp" };
  const guests = [booking.adults && `${booking.adults} ${t.adults.toLowerCase()}`, booking.children && `${booking.children} ${t.children.toLowerCase()}`, booking.infants && `${booking.infants} ${t.infants.toLowerCase()}`].filter(Boolean).join(", ");

  return (
    <Container className="max-w-2xl py-12">
      <div className="mb-6">
        <BookingSteps locale={locale} current={step} />
      </div>
      <h1 className="text-2xl font-semibold">{t.booking.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.booking.code}: <strong className="font-mono text-base text-foreground" data-testid="booking-code">{booking.code}</strong> ·{" "}
        <span data-booking-status={status}>{t.booking.status[status]}</span>
      </p>

      {sandbox && (status === "held" || confirming) && (
        <p className="mt-6 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm" data-testid="sandbox-banner">
          {t.booking.sandbox}
          <br />
          <span className="font-mono text-xs">{t.booking.sandboxCard}</span>
        </p>
      )}
      {confirming && (
        <section className="mt-6 rounded-xl border border-border p-5" data-testid="confirming">
          <p className="font-medium">{t.booking.confirming}</p>
          <AutoRefresh />
        </section>
      )}
      {(status === "deposit_paid" || status === "confirmed") && (
        <section className="mt-6 rounded-xl border border-success/40 bg-success/10 p-5" data-testid="paid">
          <h2 className="text-lg font-semibold">{t.booking.paidTitle}</h2>
          <p className="mt-1 text-sm">{t.booking.paidText}</p>
        </section>
      )}
      {status === "refund_due" && (
        <section className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-5">
          <h2 className="text-lg font-semibold">{t.booking.refundTitle}</h2>
          <p className="mt-1 text-sm">{t.booking.refundText}</p>
        </section>
      )}
      {status === "held" && !confirming && (
        <section className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold">{t.booking.heldTitle}</h2>
          <p className="mt-1 text-sm">{t.booking.heldText}</p>
          <p className="mt-4 text-sm">
            {t.booking.remaining}: <HoldCountdown expiresAt={booking.holdExpiresAt.toISOString()} />
          </p>
          {pay === "failed" && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {t.booking.payFailed}
            </p>
          )}
          <DepositButton action={startDeposit} code={booking.code} token={token!} locale={locale} label={t.booking.pay(formatVnd(booking.depositVnd, locale))} errorText={t.booking.payUnavailable} />
          <p className="mt-2 text-xs text-muted-foreground">{t.booking.payHint}</p>
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

      {next && (
        <section className="mt-8" aria-labelledby="next-title" data-testid="next-steps">
          <h2 id="next-title" className="text-lg font-semibold">
            {t.booking.nextTitle}
          </h2>
          <ol className="mt-3 grid gap-3">
            {next.map((line, i) => (
              <li key={line} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8 rounded-xl bg-muted p-5 text-sm" aria-labelledby="help-title">
        <h2 id="help-title" className="font-semibold">
          {t.booking.helpTitle}
        </h2>
        <p className="mt-1 text-muted-foreground">{t.booking.helpText(booking.code)}</p>
        <p className="mt-3 flex flex-wrap gap-4">
          <a href={chat.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">
            {chat.label}
          </a>
          <a href={telUrl()} className="font-medium text-primary underline underline-offset-4">
            {contactConfig.hotline}
          </a>
        </p>
      </section>
    </Container>
  );
}
