import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/app/_lib/staff";
import { getTours } from "@/app/_lib/tours";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatShortDay, formatVnd } from "@/product/booking/content";
import { monthRange } from "@/product/booking/reports";
import { vietnamToday } from "@/product/booking/rules";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ from?: string; to?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getBookingAdminContent((await params).locale).reports.title };
}

/** "2026-10" months from two years back to one year ahead, newest first. */
function monthOptions(today: string): string[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: 37 }, (_, i) => {
    const n = y * 12 + (m - 1) + 12 - i;
    return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
  });
}

/** Money received by channel, balances still owed, then sales per tour and per source (H3), over months. */
export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requirePermission("reports");
  const reports = container.app!.product.reports;
  const a = getBookingAdminContent(locale);
  const t = a.reports;
  const today = vietnamToday(new Date());
  const range = monthRange(await searchParams, today);
  const [report, cash, owed] = await Promise.all([reports.report(range.from, range.to), reports.cash(range.from, range.to), reports.receivables(today)]);
  const tours = (await getTours()).list(locale);
  const title = (slug: string) => tours.find((x) => x.slug === slug)?.title ?? slug;
  const money = (v: number) => formatVnd(v, locale);
  const sum = (key: "departures" | "capacity" | "seats" | "bookings" | "revenueVnd" | "depositsVnd") => report.tours.reduce((n, r) => n + r[key], 0);
  const fill = (seats: number, capacity: number) => (capacity ? `${Math.round((seats / capacity) * 100)}%` : "—");
  const csv = (kind: string) => `/api/admin/reports?${new URLSearchParams({ kind, from: range.fromMonth, to: range.toMonth, locale })}`;
  const csvLink = (kind: string) => (
    <a href={csv(kind)} className="text-sm text-primary underline underline-offset-4" data-testid={`csv-${kind}`}>
      {t.csv}
    </a>
  );
  const select = "h-10 rounded-md border border-border bg-background px-3 text-sm";
  const cell = "py-2 pr-3";
  const months = monthOptions(today);

  return (
    <div className="grid min-w-0 gap-8">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          {t.from}
          <select name="from" defaultValue={range.fromMonth} className={select}>
            {months.map((m) => <option key={m} value={m}>{t.month(m)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.to}
          <select name="to" defaultValue={range.toMonth} className={select}>
            {months.map((m) => <option key={m} value={m}>{t.month(m)}</option>)}
          </select>
        </label>
        <Button type="submit" variant="outline">{t.show}</Button>
      </form>

      <section className="grid gap-2" data-testid="report-cash">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t.cashTitle}</h2>
          {csvLink("cash")}
        </div>
        <p className="text-sm text-muted-foreground">{t.cashHint}</p>
        {cash.collectedVnd === 0 && cash.refundedVnd === 0 ? (
          <p className="text-sm text-muted-foreground">{t.cashEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>{t.cashCols.map((h) => <th key={h} className={`${cell} font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {cash.byChannel.map((r) => (
                  <tr key={r.channel} className="border-t border-border" data-cash-channel={r.channel}>
                    <td className={cell}>{t.channels[r.channel]}</td>
                    <td className={cell}>{money(r.depositsVnd)}</td>
                    <td className={cell}>{money(r.balancesVnd)}</td>
                    <td className={`${cell} font-medium`}>{money(r.depositsVnd + r.balancesVnd)}</td>
                  </tr>
                ))}
                {cash.extraVnd > 0 && (
                  <tr className="border-t border-border" data-testid="cash-extra">
                    <td className={cell} colSpan={3}>{t.extra}</td>
                    <td className={`${cell} font-medium`}>{money(cash.extraVnd)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className={cell} colSpan={3}>{t.cashTotal}</td>
                  <td className={cell} data-testid="cash-total">{money(cash.collectedVnd)}</td>
                </tr>
                <tr>
                  <td className={cell} colSpan={3}>{t.refunded}</td>
                  <td className={cell}>−{money(cash.refundedVnd)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className={cell} colSpan={3}>{t.net}</td>
                  <td className={cell}>{money(cash.collectedVnd - cash.refundedVnd)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-2" data-testid="report-receivables">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t.receivablesTitle}</h2>
          {owed.length > 0 && csvLink("receivables")}
        </div>
        <p className="text-sm text-muted-foreground">{t.receivablesHint}</p>
        {owed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.receivablesEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>{t.receivablesCols.map((h) => <th key={h} className={`${cell} font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {owed.map((r) => (
                  <tr key={r.code} className="border-t border-border">
                    <td className={`${cell} whitespace-nowrap tabular-nums`}>{formatShortDay(r.date, locale)}</td>
                    <td className={`${cell} font-mono`}>
                      <a href={localePath(locale, `/admin/bookings/${r.code}`)} className="underline-offset-2 hover:underline">{r.code}</a>
                    </td>
                    <td className={cell}>{r.name}</td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-2 hover:underline">{r.phone}</a> : "—"}
                    </td>
                    <td className={cell}>{title(r.tourSlug)}</td>
                    <td className={`${cell} whitespace-nowrap font-medium`}>{money(r.dueVnd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className={cell} colSpan={5}>{t.total}</td>
                  <td className={`${cell} whitespace-nowrap`} data-testid="receivables-total">{money(owed.reduce((n, r) => n + r.dueVnd, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t.salesTitle}</h2>
          {report.tours.length > 0 && csvLink("tours")}
        </div>
        <p className="text-sm text-muted-foreground">
          {t.hint} {formatShortDay(report.from, locale)} → {formatShortDay(report.to, locale)}
        </p>
        <h3 className="text-sm font-semibold">{t.byTour}</h3>
        {report.tours.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="report-tours">
              <thead className="text-left text-muted-foreground">
                <tr>{t.cols.map((h) => <th key={h} className={`${cell} font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {report.tours.map((r) => (
                  <tr key={r.tourSlug} className="border-t border-border" data-report-tour={r.tourSlug}>
                    <td className={cell}>{title(r.tourSlug)}</td>
                    <td className={cell}>{r.departures}</td>
                    <td className={cell}>{r.seats} / {r.capacity || "—"}</td>
                    <td className={cell}>{fill(r.seats, r.capacity)}</td>
                    <td className={cell}>{r.bookings}</td>
                    <td className={`${cell} font-medium`}>{money(r.revenueVnd)}</td>
                    <td className={cell}>{money(r.depositsVnd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold" data-testid="report-total">
                  <td className={cell}>{t.total}</td>
                  <td className={cell}>{sum("departures")}</td>
                  <td className={cell}>{sum("seats")} / {sum("capacity")}</td>
                  <td className={cell}>{fill(sum("seats"), sum("capacity"))}</td>
                  <td className={cell}>{sum("bookings")}</td>
                  <td className={cell}>{money(sum("revenueVnd"))}</td>
                  <td className={cell}>{money(sum("depositsVnd"))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {report.sources.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">{t.bySource}</h3>
            <div className="overflow-x-auto">
              <table className="w-full max-w-xl text-sm" data-testid="report-sources">
                <thead className="text-left text-muted-foreground">
                  <tr>{t.sourceCols.map((h) => <th key={h} className={`${cell} font-medium`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {report.sources.map((s) => (
                    <tr key={s.source} className="border-t border-border">
                      <td className={cell}>{a.sources[s.source]}</td>
                      <td className={cell}>{s.bookings}</td>
                      <td className={cell}>{s.seats}</td>
                      <td className={cell}>{money(s.revenueVnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <p className="text-sm">
        {t.owed}: <strong className={report.refundsOwedVnd > 0 ? "text-danger" : ""}>{money(report.refundsOwedVnd)}</strong>
      </p>
    </div>
  );
}
