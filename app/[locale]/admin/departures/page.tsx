import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/app/_lib/staff";
import { addDepartures, updateDeparture } from "@/app/actions/booking-admin";
import { Button } from "@/components/ui/button";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import type { AdminDepartureRow } from "@/product/booking/admin-departures";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatShortDay } from "@/product/booking/content";
import { bookingRules, vietnamToday } from "@/product/booking/rules";
import { getTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ tour?: string; month?: string; view?: string; result?: string; taken?: string }> };

const MONTH = /^\d{4}-\d{2}$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getBookingAdminContent(locale).departures };
}

/** Departures of one month: a calendar to see the month at a glance (default), or a table to edit seats and prices. */
export default async function AdminDeparturesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requirePermission("departures");
  const c = getBookingAdminContent(locale);
  const sp = await searchParams;
  const tours = (await getTours()).list(locale);
  const tour = tours.some((t) => t.slug === sp.tour) ? sp.tour : undefined;
  const view = sp.view === "list" ? "list" : undefined;
  const today = vietnamToday(new Date());
  const month = sp.month && MONTH.test(sp.month) ? sp.month : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = await container.app!.product.bookingAdmin.listDepartures({ tourSlug: tour, from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` });
  const title = (slug: string) => tours.find((t) => t.slug === slug)?.title ?? slug;
  const shift = (n: number) => new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
  const query = (extra: Record<string, string | undefined>) => new URLSearchParams(Object.fromEntries(Object.entries({ tour, month, view, ...extra }).filter((e): e is [string, string] => Boolean(e[1]))));
  const href = (extra: Record<string, string | undefined>) => localePath(locale, `/admin/departures?${query(extra)}`);
  const back = `/admin/departures?${query({})}`;
  const details = (d: AdminDepartureRow) => localePath(locale, `/admin/departures/${d.id}`);
  const input = "h-9 rounded-md border border-border bg-background px-2 text-sm";
  const minBadge = (d: AdminDepartureRow) =>
    d.minGuests !== null && d.status === "open" ? (
      <span className={`whitespace-nowrap text-xs font-medium ${d.sold >= d.minGuests ? "text-success" : "text-warning"}`} data-testid="min-status">
        {d.sold >= d.minGuests ? c.dep.enough : c.dep.short(d.minGuests - d.sold)}
      </span>
    ) : null;

  // Calendar: weeks from Monday; Vietnamese weekday labels are Sunday-first in the content.
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const byDay = new Map(days.map((d) => [d, rows.filter((r) => r.date === d)]));
  const weekdays = [...c.dep.weekdays.slice(1), c.dep.weekdays[0]];
  const entry = (d: AdminDepartureRow) => (
    <a
      key={d.id}
      href={details(d)}
      className={`block min-w-0 overflow-hidden rounded border px-1.5 py-1 text-xs hover:border-primary ${d.status === "closed" ? "border-dashed border-border" : "border-border bg-background"}`}
      data-calendar-departure={`${d.tourSlug}:${d.date}`}
    >
      <span className="block truncate font-medium">{title(d.tourSlug)}</span>
      <span className="flex flex-wrap items-center gap-x-2 tabular-nums text-muted-foreground">
        {d.status === "closed" ? c.dep.closed : c.dep.seats(d.sold, d.capacity)}
        {minBadge(d)}
      </span>
    </a>
  );

  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-bold">{c.departures}</h1>
      {sp.result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${sp.result === "done" ? "border-success/40 bg-success/10 text-foreground" : "border-danger/40 bg-danger/10 text-foreground"}`}>
          {sp.result === "done" ? c.result.done : sp.result === "capacity" ? c.dep.capacityBelowTaken(Number(sp.taken) || 0) : sp.result === "dates" ? c.dep.noValidDates : sp.result === "min" ? c.dep.minInvalid : c.result.failed}
        </p>
      )}

      <details className="rounded-lg border border-border p-4" data-testid="add-departures-panel">
        <summary className="cursor-pointer font-semibold">{c.dep.add}</summary>
        <form action={addDepartures} className="mt-3 grid gap-3">
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
            <label className="grid gap-1 text-sm">
              {c.dep.minGuests}
              <input type="number" name="minGuests" min={1} max={100} className={`${input} w-24`} />
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
      </details>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a href={href({ month: shift(-1) })} aria-label={c.dep.previousMonth} className="rounded border border-border px-2 py-1 hover:bg-muted">←</a>
        <span className="font-semibold" data-testid="departures-month">{c.dep.monthTitle(month)}</span>
        <a href={href({ month: shift(1) })} aria-label={c.dep.nextMonth} className="rounded border border-border px-2 py-1 hover:bg-muted">→</a>
        <form method="get" className="flex gap-2">
          <input type="hidden" name="month" value={month} />
          {view && <input type="hidden" name="view" value={view} />}
          <select name="tour" defaultValue={tour ?? ""} aria-label={c.tour} className={input}>
            <option value="">{c.allTours}</option>
            {tours.map((t) => (
              <option key={t.slug} value={t.slug}>{t.title}</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md border border-border px-3 hover:bg-muted">{c.apply}</button>
        </form>
        <nav className="ml-auto flex gap-1" aria-label={c.dep.viewLabel}>
          {([[undefined, c.dep.calendarView], ["list", c.dep.listView]] as const).map(([v, label]) => (
            <a key={label} href={href({ view: v })} aria-current={view === v ? "page" : undefined} className={`rounded-full border px-3 py-1 ${view === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {label}
            </a>
          ))}
        </nav>
      </div>

      {view === "list" ? (
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
                    <td className="py-2 pr-3">
                      <span className="whitespace-nowrap tabular-nums">{formatShortDay(d.date, locale)}</span>
                      {d.sold + d.held > 0 && (
                        <a href={details(d)} className="ml-2 font-sans text-xs text-primary underline underline-offset-2" data-testid="passengers-link">
                          {c.passengers.open}
                        </a>
                      )}
                    </td>
                    <td className="py-2 pr-3">{title(d.tourSlug)}</td>
                    <td className="py-2 pr-3">
                      {d.sold}
                      <span className="block">{minBadge(d)}</span>
                    </td>
                    <td className="py-2 pr-3">{d.held}</td>
                    <td className="py-2 pr-3">
                      <input form={form} type="number" name="capacity" min={Math.max(1, d.sold + d.held)} max={100} defaultValue={d.capacity} aria-label={`${c.dep.cols.capacity} ${d.date}`} className={`${input} w-20`} />
                    </td>
                    <td className="py-2 pr-3">
                      <input form={form} type="number" name="minGuests" min={1} max={d.capacity} defaultValue={d.minGuests ?? ""} aria-label={`${c.dep.cols.min} ${d.date}`} className={`${input} w-20`} />
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
      ) : (
        <>
          {/* Wide screens: the month as a grid. */}
          <div className="hidden md:block" data-testid="departures-calendar">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {weekdays.map((w) => <div key={w} className="py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} />)}
              {days.map((day) => (
                <div key={day} className={`min-h-24 min-w-0 rounded-md border p-1 ${day === today ? "border-primary" : "border-border"} ${day < today ? "bg-muted/50" : ""}`} data-day={day}>
                  <div className="mb-1 text-right text-xs tabular-nums text-muted-foreground">{Number(day.slice(8))}</div>
                  {/* minmax(0,1fr): long tour names truncate inside the day instead of spilling over the next one. */}
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-1">{byDay.get(day)!.map(entry)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Phones: only the days with departures, as a list. */}
          <div className="grid gap-3 md:hidden">
            {days.filter((d) => byDay.get(d)!.length > 0).map((day) => (
              <section key={day} className="grid gap-1">
                <h2 className="text-sm font-semibold capitalize">{formatShortDay(day, locale)}</h2>
                {byDay.get(day)!.map(entry)}
              </section>
            ))}
          </div>
          {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">{c.dep.empty}</p>}
        </>
      )}
    </div>
  );
}
