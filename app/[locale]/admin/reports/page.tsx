import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/app/_lib/staff";
import { getTours } from "@/app/_lib/tours";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatVnd } from "@/product/booking/content";
import { addDays, vietnamToday } from "@/product/booking/rules";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ from?: string; to?: string }> };

const MONTH = /^\d{4}-\d{2}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getBookingAdminContent((await params).locale).reports.title };
}

/** Sales report (H3): revenue, travellers and fill rate per tour, and per booking source, over a range of months. */
export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requirePermission("reports");
  const a = getBookingAdminContent(locale);
  const t = a.reports;
  const thisMonth = vietnamToday(new Date()).slice(0, 7);
  const q = await searchParams;
  const fromMonth = q.from && MONTH.test(q.from) ? q.from : thisMonth;
  const toMonth = q.to && MONTH.test(q.to) && q.to >= fromMonth ? q.to : fromMonth;
  // Last day of the "to" month: first day of the next month minus one.
  const [ty, tm] = toMonth.split("-").map(Number) as [number, number];
  const to = addDays(`${tm === 12 ? ty + 1 : ty}-${String(tm === 12 ? 1 : tm + 1).padStart(2, "0")}-01`, -1);
  const report = await container.app!.product.reports.report(`${fromMonth}-01`, to);
  const tours = (await getTours()).list(locale);
  const title = (slug: string) => tours.find((x) => x.slug === slug)?.title ?? slug;
  const money = (v: number) => formatVnd(v, locale);
  const sum = (key: "departures" | "capacity" | "seats" | "bookings" | "revenueVnd" | "depositsVnd") => report.tours.reduce((n, r) => n + r[key], 0);
  const fill = (seats: number, capacity: number) => (capacity ? `${Math.round((seats / capacity) * 100)}%` : "—");
  const input = "h-9 rounded-md border border-border bg-background px-2 text-sm";
  const cell = "py-2 pr-3";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          {t.from}
          <input type="month" name="from" defaultValue={fromMonth} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {t.to}
          <input type="month" name="to" defaultValue={toMonth} className={input} />
        </label>
        <Button type="submit" variant="outline">
          {t.show}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {t.hint} {report.from} → {report.to}
      </p>

      <section>
        <h2 className="font-semibold">{t.byTour}</h2>
        {report.tours.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <table className="mt-2 w-full text-sm" data-testid="report-tours">
            <thead className="text-left text-muted-foreground">
              <tr>
                {t.cols.map((h) => (
                  <th key={h} className={`${cell} font-medium`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.tours.map((r) => (
                <tr key={r.tourSlug} className="border-t border-border" data-report-tour={r.tourSlug}>
                  <td className={cell}>{title(r.tourSlug)}</td>
                  <td className={cell}>{r.departures}</td>
                  <td className={cell}>
                    {r.seats} / {r.capacity || "—"}
                  </td>
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
                <td className={cell}>
                  {sum("seats")} / {sum("capacity")}
                </td>
                <td className={cell}>{fill(sum("seats"), sum("capacity"))}</td>
                <td className={cell}>{sum("bookings")}</td>
                <td className={cell}>{money(sum("revenueVnd"))}</td>
                <td className={cell}>{money(sum("depositsVnd"))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {report.sources.length > 0 && (
        <section>
          <h2 className="font-semibold">{t.bySource}</h2>
          <table className="mt-2 w-full max-w-xl text-sm" data-testid="report-sources">
            <thead className="text-left text-muted-foreground">
              <tr>
                {t.sourceCols.map((h) => (
                  <th key={h} className={`${cell} font-medium`}>
                    {h}
                  </th>
                ))}
              </tr>
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
        </section>
      )}

      <p className="text-sm">
        {t.owed}: <strong className={report.refundsOwedVnd > 0 ? "text-danger" : ""}>{money(report.refundsOwedVnd)}</strong>
      </p>
    </div>
  );
}
