import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/app/_lib/staff";
import { cancelBooking, confirmBooking, markBalancePaid, markBookingRefunded, receiveTransfer, saveContact, saveStaffNote } from "@/app/actions/booking-admin";
import { Input } from "@/components/ui/input";
import { transferNote } from "@/product/booking/deposits";
import { balanceDue } from "@/product/booking/lifecycle";
import { awaitsDeposit, canMove, paidSoFar, refundLeft } from "@/product/booking/lifecycle";
import { nextStep } from "@/product/booking/next-step";
import { vietnamDayStart, vietnamToday } from "@/product/booking/rules";
import { suggestedRefundVnd } from "@/product/policies";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatDay, formatShortTime, formatVnd, getBookingContent } from "@/product/booking/content";
import { ConfirmButton } from "@/product/components/confirm-button";
import { BookingStatusBadge } from "@/product/components/booking-status-badge";
import { getTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale; code: string }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: (await params).code };
}

/** Vietnamese mobile numbers open Zalo by their local form (0…). */
function phoneLinks(phone: string): { tel: string; zalo: string } | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const local = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  return { tel: `tel:${phone.replace(/[^\d+]/g, "")}`, zalo: `https://zalo.me/${local}` };
}

export default async function AdminBookingPage({ params, searchParams }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const { admin, container, allowed } = await requirePermission("bookings.view");
  const found = await container.app!.product.bookingAdmin.get(code);
  if (!found) notFound();
  const { booking: b, departure: d, payments } = found;
  const feedback = await container.app!.product.feedback.forBooking(b.id);
  const { rows: history } = await admin.listAudit({ targetId: b.code, pageSize: 50 });
  const c = getBookingAdminContent(locale);
  const g = getBookingContent(locale);
  const { result } = await searchParams;
  const title = (await getTours()).get(locale, d.tourSlug)?.title ?? d.tourSlug;
  const time = (t: Date | null) => (t ? t.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");
  const refundOwed = refundLeft(b) > 0;
  const transferChosen = payments.some((p) => p.method === "transfer" && p.status === "pending");
  const waitingDeposit = awaitsDeposit(b.status);
  const step = nextStep(b, { transferChosen });
  const stepText =
    step.kind === "refund" ? c.detail.next.refund(formatVnd(step.amountVnd, locale))
    : step.kind === "await_transfer" ? c.detail.next.await_transfer(formatShortTime(step.until))
    : step.kind === "await_online" ? c.detail.next.await_online(formatShortTime(step.until))
    : step.kind === "collect_balance" ? c.detail.next.collect_balance(formatVnd(step.amountVnd, locale))
    : step.kind === "travellers" ? c.detail.next.travellers(step.missing)
    : c.detail.next[step.kind];
  const contact = phoneLinks(b.phone);
  const today = vietnamToday(new Date());
  const tripOver = d.date < today;
  // Cancellation: what the guest paid, and the refund the policy suggests for today (staff may change it).
  const paid = paidSoFar(b);
  const daysBefore = Math.max(0, Math.round((vietnamDayStart(d.date).getTime() - vietnamDayStart(today).getTime()) / 86_400_000));
  const suggestedRefund = suggestedRefundVnd({ depositVnd: b.depositVnd, paidVnd: paid }, daysBefore);
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="code" value={b.code} />
    </>
  );
  const row = (label: string, value: React.ReactNode) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );

  return (
    <div className="grid min-w-0 gap-6">
      <a href={localePath(locale, "/admin/bookings")} className="text-sm text-muted-foreground hover:underline">
        {c.detail.back}
      </a>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          <span className="font-mono">{b.code}</span> <BookingStatusBadge status={b.status} label={c.filters[b.status]} />
        </h1>
        {contact && (
          <div className="flex gap-2" data-testid="admin-contact-links">
            <a href={contact.tel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">{c.detail.call} {b.phone}</a>
            <a href={contact.zalo} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">{c.detail.zalo}</a>
          </div>
        )}
      </div>
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10 text-foreground" : result === "refund_due" || result === "extra" ? "border-warning/40 bg-warning/10 text-foreground" : "border-danger/40 bg-danger/10 text-foreground"}`}>
          {result === "done" ? c.result.done : result === "too_little" ? c.detail.transferTooLittle : result === "refund_due" ? c.detail.transferRefundDue : result === "extra" ? c.detail.transferExtra : c.result.failed}
        </p>
      )}
      <section className="rounded-lg border border-primary/50 bg-primary/5 p-4" data-testid="admin-next-step">
        <h2 className="font-semibold">{c.detail.nextTitle}</h2>
        <p className="mt-1 text-sm">{stepText}</p>
      </section>

      <section className="grid gap-4 rounded-lg border border-border p-4">
        <h2 className="font-semibold">{c.detail.actions}</h2>
        <div className="flex flex-wrap gap-3">
          {allowed("bookings.confirm") && canMove(b.status, "confirmed") && (
            <form action={confirmBooking}>
              {hidden}
              <ConfirmButton question={c.detail.confirmAsk} data-testid="admin-confirm">{c.detail.confirm}</ConfirmButton>
            </form>
          )}
          {allowed("bookings.money") && balanceDue(b) > 0 && (
            <form action={markBalancePaid}>
              {hidden}
              <ConfirmButton question={c.detail.balanceAsk} variant="outline" data-testid="admin-balance">{c.detail.balanceMark}</ConfirmButton>
            </form>
          )}
        </div>
        {allowed("bookings.money") && (waitingDeposit || transferChosen) && (
          <form action={receiveTransfer} className="grid max-w-lg gap-2 rounded-md border border-border p-3" data-testid="admin-transfer">
            {hidden}
            <p className="text-sm font-medium">{c.detail.transferTitle}</p>
            {transferChosen && <p className="text-xs font-medium text-primary">{c.detail.transferChosen}</p>}
            <p className="text-xs text-muted-foreground">{c.detail.transferHint(transferNote(b.code))}</p>
            {!waitingDeposit && <p className="text-xs font-medium text-warning">{c.detail.transferExtraHint}</p>}
            <label htmlFor="transfer-amount" className="text-sm">{c.detail.transferAmount}</label>
            <Input id="transfer-amount" name="amountVnd" inputMode="numeric" autoComplete="off" required defaultValue={waitingDeposit ? String(b.depositVnd) : ""} className="max-w-48" />
            <label htmlFor="transfer-ref" className="text-sm">{c.detail.transferRef}</label>
            <Input id="transfer-ref" name="bankRef" maxLength={100} autoComplete="off" spellCheck={false} className="max-w-xs" />
            <ConfirmButton question={c.detail.transferAsk} className="w-fit" data-testid="admin-transfer-save">{c.detail.transferSave}</ConfirmButton>
          </form>
        )}
        {allowed("bookings.money") && refundOwed && (
          <form action={markBookingRefunded} className="grid max-w-lg gap-2">
            {hidden}
            <label htmlFor="refund-note" className="text-sm font-medium">{c.detail.refundNote}</label>
            <Textarea id="refund-note" name="note" rows={2} maxLength={500} />
            <ConfirmButton question={c.detail.refundedAsk} variant="outline" className="w-fit" data-testid="admin-refunded">{c.detail.refunded}</ConfirmButton>
          </form>
        )}
        {allowed("bookings.edit") && (
          <form action={saveStaffNote} className="grid max-w-lg gap-2">
            {hidden}
            <label htmlFor="staff-note" className="text-sm font-medium">{c.detail.staffNote}</label>
            <Textarea id="staff-note" name="note" rows={3} defaultValue={b.staffNote} maxLength={2000} />
            <Button type="submit" variant="outline" className="w-fit">{c.detail.saveNote}</Button>
          </form>
        )}
        {allowed("bookings.cancel") && canMove(b.status, "cancelled") && (
          <details className="max-w-lg text-sm" data-testid="admin-cancel-panel">
            <summary className="cursor-pointer text-danger">{c.detail.cancelOpen}</summary>
            <form action={cancelBooking} className="mt-3 grid gap-2">
              {hidden}
              <label htmlFor="cancel-reason" className="font-medium">{c.detail.cancelReason}</label>
              <Textarea id="cancel-reason" name="reason" rows={2} required maxLength={500} />
              {paid > 0 ? (
                <>
                  <label htmlFor="cancel-refund" className="font-medium">{c.detail.cancelRefund}</label>
                  <Input id="cancel-refund" name="refundVnd" type="number" inputMode="numeric" min={0} max={paid} step={1} required defaultValue={suggestedRefund} aria-describedby="cancel-refund-hint" className="max-w-48" />
                  <p id="cancel-refund-hint" className="text-muted-foreground">{c.detail.cancelRefundHint(formatVnd(paid, locale), formatVnd(suggestedRefund, locale), daysBefore)}</p>
                </>
              ) : (
                <input type="hidden" name="refundVnd" value="0" />
              )}
              <ConfirmButton question={c.detail.cancelAsk} variant="destructive" className="w-fit" data-testid="admin-cancel">{c.detail.cancel}</ConfirmButton>
            </form>
          </details>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{c.detail.guest}</h2>
          <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-1 text-sm">
            {row(g.name, b.name)}
            {row(g.email, <a href={`mailto:${b.email}`} className="underline">{b.email}</a>)}
            {row(g.phone, contact ? <a href={contact.tel} className="underline">{b.phone}</a> : b.phone)}
            {row(c.detail.language, c.detail.languages[b.locale] ?? b.locale)}
            {row(c.source, <span data-testid="detail-source">{c.sources[b.source]}{b.externalRef && ` · ${b.externalRef}`}</span>)}
          </dl>
          {!b.guestEmails && <p className="mt-2 text-xs font-medium text-warning">{c.noGuestEmails}</p>}
          {allowed("bookings.edit") && (
          <details className="mt-3 text-sm" data-testid="admin-contact">
            <summary className="cursor-pointer text-primary">{c.detail.editContact}</summary>
            <form action={saveContact} className="mt-2 grid gap-2">
              {hidden}
              <p className="text-xs text-muted-foreground">{c.detail.contactHint}</p>
              <label className="grid gap-1">
                {g.name}
                <Input name="name" required minLength={2} maxLength={100} defaultValue={b.name} autoComplete="off" />
              </label>
              <label className="grid gap-1">
                {g.email}
                <Input name="email" type="email" required={b.guestEmails} maxLength={200} defaultValue={b.email} autoComplete="off" spellCheck={false} />
              </label>
              <label className="grid gap-1">
                {g.phone}
                <Input name="phone" type="tel" maxLength={30} defaultValue={b.phone} autoComplete="off" />
              </label>
              <Button type="submit" variant="outline" className="w-fit" data-testid="admin-contact-save">{c.detail.saveContact}</Button>
            </form>
          </details>
          )}
        </section>
        <section className="min-w-0 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{c.detail.trip}</h2>
          <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-1 text-sm">
            {row(c.tour, d.kind === "private" ? <>{title} · <strong data-testid="private-tour">{c.privateTour}</strong></> : title)}
            {row(c.columns.date, <span className="capitalize">{formatDay(d.date, locale)}</span>)}
            {row(g.adults, b.adults)}
            {row(g.children, b.children)}
            {row(g.infants, b.infants)}
            {b.singleRooms > 0 && row(g.singleRooms, b.singleRooms)}
            {b.addons.length > 0 && row(g.addonsTitle, b.addons.map((a) => `${g.addonLine(a.name[locale], a.qty)} (${formatVnd(a.vnd, locale)})`).join(", "))}
          </dl>
        </section>
        <section className="min-w-0 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{c.detail.money}</h2>
          <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-1 text-sm tabular-nums">
            {b.discountVnd > 0 && row(g.discount.line(b.discountCode ?? ""), `−${formatVnd(b.discountVnd, locale)}`)}
            {row(c.detail.total, formatVnd(b.totalVnd, locale))}
            {row(c.detail.deposit, formatVnd(b.depositVnd, locale))}
            {row(c.detail.paidAt, time(b.depositPaidAt))}
            {row(c.detail.rest, formatVnd(b.totalVnd - b.depositVnd, locale))}
            {b.balancePaidAt && row(c.detail.balancePaidAt, time(b.balancePaidAt))}
            {b.refundDueVnd > 0 && row(c.detail.refundDue, <strong className={refundOwed ? "text-danger" : ""}>{formatVnd(refundOwed ? refundLeft(b) : b.refundDueVnd, locale)}</strong>)}
            {b.refundedAt && row(c.detail.refundedAt, b.refundNote ? `${time(b.refundedAt)} · ${b.refundNote}` : time(b.refundedAt))}
          </dl>
        </section>
      </div>

      {(b.note || b.cancelReason) && (
        <section className="grid gap-2 text-sm">
          {b.note && <p><span className="text-muted-foreground">{c.detail.guestNote}:</span> {b.note}</p>}
          {b.cancelReason && <p><span className="text-muted-foreground">{c.detail.cancelledReason}:</span> {b.cancelReason}</p>}
        </section>
      )}

      <section className="rounded-lg border border-border p-4" data-testid="admin-travellers">
        <h2 className="font-semibold">{g.travellers.title}</h2>
        {b.travellers.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{g.travellers.missing}</p>
        ) : (
          <ol className="mt-2 grid gap-1 text-sm">
            {b.travellers.map((p, i) => (
              <li key={i}>
                {i + 1}. {p.name} · {p.birthYear}
              </li>
            ))}
          </ol>
        )}
      </section>

      {(feedback || tripOver) && (
        <section className="rounded-lg border border-border p-4" data-testid="admin-feedback">
          <h2 className="font-semibold">{g.feedback.staffTitle}</h2>
          {feedback ? (
            <p className="mt-1 text-sm">
              <span role="img" aria-label={`${feedback.rating}/5`}>{"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}</span> {g.feedback.stars[feedback.rating as 1 | 2 | 3 | 4 | 5]}
              {feedback.comment && <span className="mt-1 block whitespace-pre-line text-muted-foreground">{feedback.comment}</span>}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{g.feedback.staffNone}</p>
          )}
        </section>
      )}

      <section className="min-w-0">
        <h2 className="font-semibold">{c.detail.payments}</h2>
        {payments.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{c.detail.noPayments}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm" data-testid="admin-payments">
              <thead className="text-muted-foreground">
                <tr>
                  {Object.values(c.detail.paymentCols).map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-4">{c.detail.methods[p.method]}{p.bankCode && <span className="block text-xs text-muted-foreground">{p.bankCode}</span>}</td>
                    <td className="py-2 pr-4">{c.detail.purposes[p.purpose]}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {p.txnRef}
                      {p.providerTxnNo && <span className="block">{p.method === "transfer" ? c.detail.bankRef : "VNPay"} {p.providerTxnNo}</span>}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{formatVnd(p.amountVnd, locale)}</td>
                    <td className="py-2 pr-4">{c.detail.paymentStatuses[p.status]}{p.responseCode && ` (${p.responseCode})`}</td>
                    <td className="py-2 whitespace-nowrap">{time(p.paidAt ?? p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold">{c.detail.history}</h2>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{c.detail.noHistory}</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm" data-testid="admin-history">
            {history.map((h) => (
              <li key={h.id} data-action={h.action}>
                <span className="text-muted-foreground">{time(h.createdAt)}</span> · {h.actorEmail} · {c.detail.auditActions[h.action] ?? h.action}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
