import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { addDepartures, updateDeparture } from "@/app/actions/booking-admin";
import { Button } from "@/components/ui/button";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { bookingRules, vietnamToday } from "@/product/booking/rules";
import { getTourCatalog } from "@/product/tours/catalog";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ tour?: string; month?: string; result?: string }> };

const MONTH = /^\d{4}-\d{2}$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getBookingAdminContent(locale).departures };
}

export default async function AdminDeparturesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  const c = getBookingAdminContent(locale);
  const sp = await searchParams;
  const tours = getTourCatalog().list(locale);
  const tour = tours.some((t) => t.slug === sp.tour) ? sp.tour : undefined;
  const today = vietnamToday(new Date());
  const month = sp.month && MONTH.test(sp.month) ? sp.month : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = await container.app!.product.bookingAdmin.listDepartures({ tourSlug: tour, from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` });
  const title = (slug: string) => tours.find((t) => t.slug === slug)?.title ?? slug;
  const shift = (n: number) => new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
  const href = (extra: Record<string, string>) => localePath(locale, `/admin/departures?${new URLSearchParams(Object.fromEntries(Object.entries({ tour, month, ...extra }).filter((e): e is [string, string] => Boolean(e[1]))))}`);
  const back = `/admin/departures?${new URLSearchParams(Object.fromEntries(Object.entries({ tour, month }).filter((e): e is [string, string] => Boolean(e[1]))))}`;
  const input = "h-9 rounded-md border border-border bg-background px-2 text-sm";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{c.departures}</h1>
      {sp.result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${sp.result === "done" ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}>
          {sp.result === "done" ? c.result.done : c.result.failed}
        </p>
      )}

      <form action={addDepartures} className="grid gap-3 rounded-lg border border-border p-4">
        <h2 className="font-semibold">{c.dep.add}</h2>
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            {c.tour}
            <select name="tourSlug" defaultValue={tour ?? tours[0]?.slug} className={input} required>
              {tours.map((t) => (
                <option key={t.slug} value={t.slug}>{t.title}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            {c.dep.startDate}
            <input type="date" name="from" min={today} defaultValue={today} className={input} required />
          </label>
          <label className="grid gap-1 text-sm">
            {c.dep.weeks}
            <input type="number" name="weeks" min={1} max={26} defaultValue={8} className={`${input} w-20`} />
          </label>
          <label className="grid gap-1 text-sm">
            {c.dep.capacity}
            <input type="number" name="capacity" min={1} max={100} defaultValue={bookingRules.defaultCapacity} className={`${input} w-20`} required />
          </label>
          <label className="grid gap-1 text-sm">
            {c.dep.price}
            <input name="priceVnd" inputMode="numeric" className={`${input} w-40`} />
          </label>
        </div>
        <fieldset className="flex flex-wrap items-center gap-3 text-sm">
          <legend className="mb-1 text-sm">{c.dep.repeat}</legend>
          {c.dep.weekdays.map((label, i) => (
            <label key={label} className="flex items-center gap-1">
              <input type="checkbox" name="weekday" value={i} /> {label}
            </label>
          ))}
        </fieldset>
        <Button type="submit" className="w-fit" data-testid="add-departures">{c.dep.addButton}</Button>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a href={href({ month: shift(-1) })} className="rounded border border-border px-2 py-1 hover:bg-muted">←</a>
        <span className="font-semibold">{c.dep.month} {month}</span>
        <a href={href({ month: shift(1) })} className="rounded border border-border px-2 py-1 hover:bg-muted">→</a>
        <form method="get" className="flex gap-2">
          <input type="hidden" name="month" value={month} />
          <select name="tour" defaultValue={tour ?? ""} aria-label={c.tour} className={input}>
            <option value="">{c.allTours}</option>
            {tours.map((t) => (
              <option key={t.slug} value={t.slug}>{t.title}</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md border border-border px-3 hover:bg-muted">{c.apply}</button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="departures-table">
          <thead className="text-muted-foreground">
            <tr>
              {Object.values(c.dep.cols).map((h) => (
                <th key={h} className="py-2 pr-3 font-medium">{h}</th>
              ))}
              <th className="py-2"><span className="sr-only">{c.dep.save}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const form = `dep-${d.id}`;
              return (
                <tr key={d.id} className="border-t border-border" data-departure-row={`${d.tourSlug}:${d.date}`}>
                  <td className="py-2 pr-3 font-mono">{d.date}</td>
                  <td className="py-2 pr-3">{title(d.tourSlug)}</td>
                  <td className="py-2 pr-3">{d.sold}</td>
                  <td className="py-2 pr-3">{d.held}</td>
                  <td className="py-2 pr-3">
                    <input form={form} type="number" name="capacity" min={Math.max(1, d.sold + d.held)} max={100} defaultValue={d.capacity} aria-label={`${c.dep.cols.capacity} ${d.date}`} className={`${input} w-20`} />
                  </td>
                  <td className="py-2 pr-3">
                    <input form={form} name="priceVnd" inputMode="numeric" defaultValue={d.priceVnd ?? ""} placeholder={c.dep.listPrice} aria-label={`${c.dep.cols.price} ${d.date}`} className={`${input} w-32`} />
                  </td>
                  <td className="py-2 pr-3">
                    <select form={form} name="status" defaultValue={d.status} aria-label={`${c.dep.cols.status} ${d.date}`} className={input}>
                      <option value="open">{c.dep.open}</option>
                      <option value="closed">{c.dep.closed}</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <form id={form} action={updateDeparture}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="back" value={back} />
                      <Button type="submit" size="sm" variant="outline">{c.dep.save}</Button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">{c.dep.empty}</p>}
      </div>
    </div>
  );
}
