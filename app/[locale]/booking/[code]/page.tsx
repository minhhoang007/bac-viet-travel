import type { Metadata } from "next";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { getBooking, getDeposits, isPaymentsSandbox, isTransferAvailable } from "@/app/_lib/booking";
import { chooseTransfer, saveTravellers, startBalance, startDeposit } from "@/app/actions/booking";
import { balanceDue } from "@/product/booking/deposits";
import { vietnamToday } from "@/product/booking/rules";
import { travellersEditable } from "@/product/booking/service";
import { TravellersForm } from "@/product/components/travellers-form";
import { bankTransferConfig } from "@/config/bank-transfer";
import { vietQrSvg } from "@/core/payments/vietqr";
import { transferNote } from "@/product/booking/deposits";
import { CopyButton } from "@/product/components/copy-button";
import { Button } from "@/components/ui/button";
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
  const today = vietnamToday(new Date());
  const kinds = [...Array<"adult">(booking.adults).fill("adult"), ...Array<"child">(booking.children).fill("child"), ...Array<"infant">(booking.infants).fill("infant")];
  const transferOffered = status === "held" && isTransferAvailable();
  const transfer = transferOffered && (await getDeposits().transferPending(booking.id));
  const holdUntil = booking.holdExpiresAt.toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  // Back from VNPay with a success code, but the IPN has not arrived yet.
  const confirming = status === "held" && pay === "pending";
  const rebook = localePath(locale, `/tours/${booking.departure.tourSlug}/book?d=${booking.departure.id}`);
  const step = status === "held" ? 2 : status === "deposit_paid" || status === "confirmed" ? 3 : null;
  const next = status === "held" ? t.booking.nextHeld : status === "deposit_paid" || status === "confirmed" ? t.booking.nextPaid : null;
  const chat = locale === "vi" ? { href: zaloUrl(), label: "Zalo" } : { href: whatsappUrl(), label: "WhatsApp" };
  const guests = [
    booking.adults && `${booking.adults} ${t.adults.toLowerCase()}`,
    booking.children && `${booking.children} ${t.children.toLowerCase()}`,
    booking.infants && `${booking.infants} ${t.infants.toLowerCase()}`,
    booking.singleRooms && t.singleLine(booking.singleRooms),
    ...booking.addons.map((a) => t.addonLine(a.name[locale], a.qty)),
  ]
    .filter(Boolean)
    .join(", ");

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
          {balanceDue(booking) > 0 && booking.departure.date >= today ? (
            <div className="mt-4 border-t border-success/30 pt-4" data-testid="balance">
              <p className="font-medium">{t.booking.balanceTitle(formatVnd(balanceDue(booking), locale))}</p>
              <p className="mt-1 text-sm">{t.booking.balanceText}</p>
              <DepositButton action={startBalance} code={booking.code} token={token!} locale={locale} label={t.booking.balancePay(formatVnd(balanceDue(booking), locale))} errorText={t.booking.payUnavailable} testId="pay-balance" />
            </div>
          ) : (
            booking.balancePaidAt && (
              <p className="mt-3 text-sm font-medium" data-testid="balance-paid">
                {t.booking.balancePaid}
              </p>
            )
          )}
          <ButtonLink href={localePath(locale, `/booking/${booking.code}/voucher?t=${encodeURIComponent(token!)}`)} variant="outline" className="mt-3" data-testid="open-voucher">
            {t.voucher.open}
          </ButtonLink>
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
          <p className="mt-1 text-sm">{transfer ? t.booking.transferHeldText(holdUntil) : t.booking.heldText}</p>
          <p className="mt-4 text-sm">
            {t.booking.remaining}: <HoldCountdown expiresAt={booking.holdExpiresAt.toISOString()} />
          </p>
          {(pay === "failed" || pay === "transfer_failed") && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {pay === "failed" ? t.booking.payFailed : t.booking.transferFailed}
            </p>
          )}
          {transfer && <TransferPanel locale={locale} code={booking.code} amountVnd={booking.depositVnd} />}
          {transfer && <p className="mt-6 text-sm font-medium">{t.booking.transferOrPay}</p>}
          <DepositButton action={startDeposit} code={booking.code} token={token!} locale={locale} label={t.booking.pay(formatVnd(booking.depositVnd, locale))} errorText={t.booking.payUnavailable} />
          <p className="mt-2 text-xs text-muted-foreground">{t.booking.payHint}</p>
          {transferOffered && !transfer && (
            <form action={chooseTransfer} className="mt-4 border-t border-border pt-4">
              <input type="hidden" name="code" value={booking.code} />
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="outline" className="w-full sm:w-auto" data-testid="choose-transfer">
                {t.booking.transferChoose}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{t.booking.transferChooseHint}</p>
            </form>
          )}
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

      {(status === "held" || status === "deposit_paid" || status === "confirmed") && (
        <section className="mt-8 rounded-xl border border-border p-5" aria-labelledby="travellers-title" data-testid="travellers">
          <h2 id="travellers-title" className="text-lg font-semibold">
            {t.travellers.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.travellers.length === kinds.length ? t.travellers.done(kinds.length) : t.travellers.missing} {t.travellers.hint}
          </p>
          {travellersEditable(booking.status, booking.isExpired, booking.departure.date, new Date()) ? (
            <TravellersForm action={saveTravellers} code={booking.code} token={token!} locale={locale} kinds={kinds} initial={booking.travellers} />
          ) : (
            <ol className="mt-3 grid gap-1 text-sm">
              {booking.travellers.map((p, i) => (
                <li key={i}>
                  {i + 1}. {p.name} ({p.birthYear})
                </li>
              ))}
            </ol>
          )}
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
        {booking.discountVnd > 0 && (
          <>
            <dt className="text-muted-foreground">{t.discount.line(booking.discountCode ?? "")}</dt>
            <dd className="text-success" data-testid="booking-discount">−{formatVnd(booking.discountVnd, locale)}</dd>
          </>
        )}
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

/** VietQR and account details for a bank transfer of the deposit (staff confirm it in the admin). */
function TransferPanel({ locale, code, amountVnd }: { locale: Locale; code: string; amountVnd: number }) {
  const t = getBookingContent(locale).booking;
  const bank = bankTransferConfig;
  const note = transferNote(code);
  const amount = formatVnd(amountVnd, locale);
  const qr = vietQrSvg({ bankBin: bank.bankBin, accountNumber: bank.accountNumber, amountVnd, note });
  const line = (label: string, value: string, copy?: string) => (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 font-medium">
        <span className={copy ? "font-mono" : ""}>{value}</span>
        {copy && <CopyButton value={copy} label={t.transferCopy} copiedLabel={t.transferCopied} name={label} />}
      </dd>
    </div>
  );
  return (
    <div className="mt-5 rounded-xl border border-border bg-background p-4" data-testid="transfer">
      <h3 className="font-semibold">{t.transferTitle}</h3>
      {bank.demo && (
        <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm font-medium" data-demo="bank-account">
          {t.transferDemo}
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">{t.transferText}</p>
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-[180px_1fr]">
        <div role="img" aria-label={t.transferQrLabel(amount)} className="mx-auto w-44 bg-white p-1 sm:w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        <dl className="divide-y divide-border text-sm">
          {line(t.transferBank, bank.bankName)}
          {line(t.transferAccount, bank.accountNumber, bank.accountNumber)}
          {line(t.transferName, bank.accountName)}
          {line(t.transferAmount, amount, String(amountVnd))}
          {line(t.transferNote, note, note)}
        </dl>
      </div>
      <p className="mt-4 text-sm">{t.transferAfter}</p>
      <AutoRefresh everyMs={30_000} maxTimes={240} />
    </div>
  );
}
