import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/app/_lib/staff";
import { getTours } from "@/app/_lib/tours";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatDay } from "@/product/booking/content";
import { PrintButton } from "@/product/components/print-button";
import { cancelDeparture } from "@/app/actions/booking-admin";
import { Textarea } from "@/components/ui/textarea";
import { vietnamToday } from "@/product/booking/rules";
import { ConfirmButton } from "@/product/components/confirm-button";

type Props = { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getBookingAdminContent((await params).locale).passengers.title };
}

/** Passenger list of one departure (H1): for the guide, printable and as CSV. */
export default async function PassengersPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { container, allowed } = await requirePermission("bookings.view");
  const { result } = await searchParams;
  const a = getBookingAdminContent(locale);
  const found = await container.app!.product.bookingAdmin.passengers(id);
  if (!found) notFound();
  const { departure: d, rows } = found;
  const c = getBookingAdminContent(locale).passengers;
  const title = (await getTours()).get(locale, d.tourSlug)?.title ?? d.tourSlug;
  const people = rows.reduce((n, r) => n + (r.missing || 1), 0);
  const bookings = new Set(rows.map((r) => r.code)).size;

  return (
    <div className="grid gap-4">
      <style>{`@media print { header, footer, nav, [data-print-hide] { display: none !important; } }`}</style>
      <div data-print-hide className="flex flex-wrap items-center gap-3">
        <a href={localePath(locale, `/admin/departures?tour=${encodeURIComponent(d.tourSlug)}&month=${d.date.slice(0, 7)}`)} className="text-sm text-muted-foreground hover:underline">
          {c.back}
        </a>
        <PrintButton label={c.print} />
        <a href={`/api/admin/departures/${d.id}/passengers?locale=${locale}`} className="text-sm font-medium text-primary underline underline-offset-4" data-testid="passengers-csv">
          {c.csv}
        </a>
      </div>
      <h1 className="text-2xl font-bold">
        {c.title}: {title}
      </h1>
      <p className="text-sm">
        <span className="capitalize">{formatDay(d.date, locale)}</span> · <span data-testid="passengers-summary">{c.summary(people, bookings)}</span>
      </p>
      {result && (
        <p role="status" data-print-hide className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          {result === "done" ? a.result.done : a.result.failed}
        </p>
      )}
      {d.status === "closed" && <p className="text-sm font-medium text-warning" data-print-hide>{c.closedNote}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <table className="w-full text-sm" data-testid="passengers">
          <thead className="text-left text-muted-foreground">
            <tr>
              {Object.values(c.cols).map((h) => (
                <th key={h} className="py-2 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.code}-${i}`} className="border-t border-border align-top">
                <td className="py-1.5 pr-3">{i + 1}</td>
                <td className="py-1.5 pr-3 font-medium">
                  {r.name}
                  {r.missing > 0 && <span className="ml-1 text-xs font-normal text-warning">({c.missing(r.missing)})</span>}
                </td>
                <td className="py-1.5 pr-3">{r.birthYear ?? "—"}</td>
                <td className="py-1.5 pr-3">{r.kind ? c.kinds[r.kind] : "—"}</td>
                <td className="py-1.5 pr-3 font-mono">
                  <a href={localePath(locale, `/admin/bookings/${r.code}`)} className="hover:underline">
                    {r.code}
                  </a>
                </td>
                <td className="py-1.5 pr-3">{r.contact}</td>
                <td className="py-1.5 pr-3">{r.phone}</td>
                <td className="py-1.5 pr-3">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {allowed("bookings.cancel") && d.kind === "group" && (d.status === "open" || rows.length > 0) && d.date >= vietnamToday(new Date()) && (
        <details className="mt-4 max-w-xl rounded-lg border border-border p-4 text-sm" data-print-hide data-testid="cancel-departure">
          <summary className="cursor-pointer font-medium text-danger">{c.cancelTitle}…</summary>
          <form action={cancelDeparture} className="mt-3 grid gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={d.id} />
            <p className="text-muted-foreground">{c.cancelHint}</p>
            <label htmlFor="departure-cancel-reason" className="font-medium">{c.cancelReason}</label>
            <Textarea id="departure-cancel-reason" name="reason" rows={2} required maxLength={500} />
            <ConfirmButton question={c.cancelAsk} variant="destructive" className="w-fit" data-testid="cancel-departure-submit">{c.cancelButton}</ConfirmButton>
          </form>
        </details>
      )}
    </div>
  );
}
