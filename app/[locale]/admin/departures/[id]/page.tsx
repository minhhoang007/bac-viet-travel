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

type Props = { params: Promise<{ locale: Locale; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getBookingAdminContent((await params).locale).passengers.title };
}

/** Passenger list of one departure (H1): for the guide, printable and as CSV. */
export default async function PassengersPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { container } = await requirePermission("bookings.view");
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
    </div>
  );
}
