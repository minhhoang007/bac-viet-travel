import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { cancelBooking, confirmBooking, markBalancePaid, markBookingRefunded, receiveTransfer, saveStaffNote } from "@/app/actions/booking-admin";
import { Input } from "@/components/ui/input";
import { balanceDue, transferNote } from "@/product/booking/deposits";
import { awaitsDeposit, canMove } from "@/product/booking/lifecycle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatDay, formatVnd, getBookingContent } from "@/product/booking/content";
import { ConfirmButton } from "@/product/components/confirm-button";
import { getTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale; code: string }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: (await params).code };
}

export default async function AdminBookingPage({ params, searchParams }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const { admin, container } = await requireAdmin();
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
  const refundOwed = b.refundDueVnd > 0 && !b.refundedAt;
  const transferChosen = payments.some((p) => p.method === "transfer" && p.status === "pending");
  const waitingDeposit = awaitsDeposit(b.status);
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="code" value={b.code} />
    </>
  );
  const row = (label: string, value: React.ReactNode) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );

  return (
    <div className="grid gap-6">
      <a href={localePath(locale, "/admin/bookings")} className="text-sm text-muted-foreground hover:underline">
        {c.detail.back}
      </a>
      <h1 className="text-2xl font-bold">
        <span className="font-mono">{b.code}</span> · <span data-admin-status={b.status}>{c.filters[b.status]}</span>
      </h1>
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10 text-foreground" : result === "refund_due" || result === "extra" ? "border-warning/40 bg-warning/10 text-foreground" : "border-danger/40 bg-danger/10 text-foreground"}`}>
          {result === "done" ? c.result.done : result === "too_little" ? c.detail.transferTooLittle : result === "refund_due" ? c.detail.transferRefundDue : result === "extra" ? c.detail.transferExtra : c.result.failed}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-semibold">{c.detail.guest}</h2>
          <dl className="mt-2 grid grid-cols-[110px_1fr] gap-1 text-sm">
            {row(g.name, b.name)}
            {row(g.email, <a href={`mailto:${b.email}`} className="underline">{b.email}</a>)}
            {row(g.phone, b.phone)}
            {row("Locale", b.locale)}
            {row(c.source, <span data-testid="detail-source">{c.sources[b.source]}{b.externalRef && ` · ${b.externalRef}`}</span>)}
          </dl>
          {!b.guestEmails && <p className="mt-2 text-xs font-medium text-warning">{c.noGuestEmails}</p>}
        </section>
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-semibold">{c.detail.trip}</h2>
          <dl className="mt-2 grid grid-cols-[110px_1fr] gap-1 text-sm">
            {row(c.tour, d.kind === "private" ? <>{title} · <strong data-testid="private-tour">{c.privateTour}</strong></> : title)}
            {row(c.columns.date, <span className="capitalize">{formatDay(d.date, locale)}</span>)}
            {row(g.adults, b.adults)}
            {row(g.children, b.children)}
            {row(g.infants, b.infants)}
            {b.singleRooms > 0 && row(g.singleRooms, b.singleRooms)}
            {b.addons.length > 0 && row(g.addonsTitle, b.addons.map((a) => `${g.addonLine(a.name[locale], a.qty)} (${formatVnd(a.vnd, locale)})`).join(", "))}
          </dl>
        </section>
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-semibold">{c.detail.money}</h2>
          <dl className="mt-2 grid grid-cols-[110px_1fr] gap-1 text-sm">
            {b.discountVnd > 0 && row(g.discount.line(b.discountCode ?? ""), `−${formatVnd(b.discountVnd, locale)}`)}
            {row(c.detail.total, formatVnd(b.totalVnd, locale))}
            {row(c.detail.deposit, formatVnd(b.depositVnd, locale))}
            {row(c.detail.paidAt, time(b.depositPaidAt))}
            {row(c.detail.rest, formatVnd(b.totalVnd - b.depositVnd, locale))}
            {b.balancePaidAt && row(c.detail.balancePaidAt, time(b.balancePaidAt))}
            {b.refundDueVnd > 0 && row(c.detail.refundDue, <strong className={refundOwed ? "text-danger" : ""}>{formatVnd(b.refundDueVnd, locale)}</strong>)}
            {b.refundedAt && row(c.detail.refundedAt, `${time(b.refundedAt)} · ${b.refundNote ?? ""}`)}
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-border p-4" data-testid="admin-feedback">
        <h2 className="font-semibold">{g.feedback.staffTitle}</h2>
        {feedback ? (
          <p className="mt-1 text-sm">
            <span aria-label={`${feedback.rating}/5`}>{"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}</span> {g.feedback.stars[feedback.rating as 1 | 2 | 3 | 4 | 5]}
            {feedback.comment && <span className="mt-1 block whitespace-pre-line text-muted-foreground">{feedback.comment}</span>}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{g.feedback.staffNone}</p>
        )}
      </section>

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

      {(b.note || b.cancelReason) && (
        <section className="grid gap-2 text-sm">
          {b.note && <p><span className="text-muted-foreground">{c.detail.guestNote}:</span> {b.note}</p>}
          {b.cancelReason && <p><span className="text-muted-foreground">{c.detail.cancelledReason}:</span> {b.cancelReason}</p>}
        </section>
      )}

      <section className="grid gap-4 rounded-lg border border-border p-4">
        <h2 className="font-semibold">{c.detail.actions}</h2>
        <div className="flex flex-wrap gap-3">
          {balanceDue(b) > 0 && (
            <form action={markBalancePaid}>
              {hidden}
              <ConfirmButton question={c.detail.balanceAsk} variant="outline" data-testid="admin-balance">{c.detail.balanceMark}</ConfirmButton>
            </form>
          )}
          {canMove(b.status, "confirmed") && (
            <form action={confirmBooking}>
              {hidden}
              <ConfirmButton question={c.detail.confirmAsk} data-testid="admin-confirm">{c.detail.confirm}</ConfirmButton>
            </form>
          )}
        </div>
        {(waitingDeposit || transferChosen) && (
          <form action={receiveTransfer} className="grid max-w-lg gap-2 rounded-md border border-border p-3" data-testid="admin-transfer">
            {hidden}
            <p className="text-sm font-medium">{c.detail.transferTitle}</p>
            {transferChosen && <p className="text-xs font-medium text-primary">{c.detail.transferChosen}</p>}
            <p className="text-xs text-muted-foreground">{c.detail.transferHint(transferNote(b.code))}</p>
            {!waitingDeposit && <p className="text-xs font-medium text-warning">{c.detail.transferExtraHint}</p>}
            <label htmlFor="transfer-amount" className="text-sm">{c.detail.transferAmount}</label>
            <Input id="transfer-amount" name="amountVnd" inputMode="numeric" required defaultValue={waitingDeposit ? String(b.depositVnd) : ""} className="max-w-48" />
            <label htmlFor="transfer-ref" className="text-sm">{c.detail.transferRef}</label>
            <Input id="transfer-ref" name="bankRef" maxLength={100} className="max-w-xs" />
            <ConfirmButton question={c.detail.transferAsk} className="w-fit" data-testid="admin-transfer-save">{c.detail.transferSave}</ConfirmButton>
          </form>
        )}
        {canMove(b.status, "cancelled") && (
          <form action={cancelBooking} className="grid max-w-lg gap-2">
            {hidden}
            <label htmlFor="cancel-reason" className="text-sm font-medium">{c.detail.cancelReason}</label>
            <Textarea id="cancel-reason" name="reason" rows={2} required maxLength={500} />
            {b.status !== "held" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="refund" defaultChecked /> {c.detail.cancelRefund}
              </label>
            )}
            <ConfirmButton question={c.detail.cancelAsk} variant="destructive" className="w-fit" data-testid="admin-cancel">{c.detail.cancel}</ConfirmButton>
          </form>
        )}
        {refundOwed && (
          <form action={markBookingRefunded} className="grid max-w-lg gap-2">
            {hidden}
            <label htmlFor="refund-note" className="text-sm font-medium">{c.detail.refundNote}</label>
            <Textarea id="refund-note" name="note" rows={2} maxLength={500} />
            <ConfirmButton question={c.detail.refundedAsk} variant="outline" className="w-fit" data-testid="admin-refunded">{c.detail.refunded}</ConfirmButton>
          </form>
        )}
        <form action={saveStaffNote} className="grid max-w-lg gap-2">
          {hidden}
          <label htmlFor="staff-note" className="text-sm font-medium">{c.detail.staffNote}</label>
          <Textarea id="staff-note" name="note" rows={3} defaultValue={b.staffNote} maxLength={2000} />
          <Button type="submit" variant="outline" className="w-fit">{c.detail.saveNote}</Button>
        </form>
      </section>

      <section>
        <h2 className="font-semibold">{c.detail.payments}</h2>
        {payments.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{c.detail.noPayments}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm">
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
                    <td className="py-2 pr-4 font-mono text-xs">{p.txnRef}{p.providerTxnNo && <span className="block">VNPay {p.providerTxnNo}</span>}</td>
                    <td className="py-2 pr-4">{formatVnd(p.amountVnd, locale)}</td>
                    <td className="py-2 pr-4">{p.status}{p.responseCode && ` (${p.responseCode})`}</td>
                    <td className="py-2 pr-4">{p.bankCode ?? "—"}</td>
                    <td className="py-2">{time(p.paidAt ?? p.createdAt)}</td>
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
              <li key={h.id}>
                <span className="text-muted-foreground">{time(h.createdAt)}</span> · {h.actorEmail} · <span className="font-mono">{h.action}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
