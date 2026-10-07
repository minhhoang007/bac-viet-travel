import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/app/_lib/staff";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import type { BookingFilter } from "@/product/booking/admin";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { formatShortDay, formatVnd } from "@/product/booking/content";
import { BookingStatusBadge } from "@/product/components/booking-status-badge";
import { BOOKING_SOURCES, type BookingSource } from "@/product/booking/sources";
import { getTours } from "@/app/_lib/tours";

const PAGE_SIZE = 25;
const FILTERS = ["attention", "all", "held", "deposit_paid", "refund_due", "confirmed", "cancelled", "expired"] as const satisfies readonly BookingFilter[];

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ filter?: string; source?: string; tour?: string; from?: string; to?: string; q?: string; page?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getBookingAdminContent(locale).bookings };
}

export default async function AdminBookingsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container, allowed } = await requirePermission("bookings.view");
  const service = container.app!.product.bookingAdmin;
  const c = getBookingAdminContent(locale);
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.filter ?? "") ? (sp.filter as BookingFilter) : "attention";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const tours = (await getTours()).list(locale);
  const tour = tours.some((t) => t.slug === sp.tour) ? sp.tour : undefined;
  const source = (BOOKING_SOURCES as readonly string[]).includes(sp.source ?? "") ? (sp.source as BookingSource) : undefined;
  const [{ rows, total }, stats] = await Promise.all([
    service.list({ filter, source, tourSlug: tour, from: sp.from, to: sp.to, query: sp.q, page, pageSize: PAGE_SIZE }),
    service.stats(),
  ]);
  const title = (slug: string) => tours.find((t) => t.slug === slug)?.title ?? slug;
  const query = (extra: Record<string, string>) =>
    localePath(locale, `/admin/bookings?${new URLSearchParams(Object.fromEntries(Object.entries({ filter, source, tour, from: sp.from, to: sp.to, q: sp.q, ...extra }).filter((e): e is [string, string] => Boolean(e[1]))))}`);
  const input = "h-10 rounded-md border border-border bg-background px-3 text-sm";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{c.bookings}</h1>
        {allowed("bookings.edit") && (
          <a href={localePath(locale, "/admin/bookings/new")} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {c.newBooking}
          </a>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-4" data-testid="booking-stats">
        {[
          [c.stats.attention, stats.attention],
          [c.stats.paidToday, stats.paidToday],
          [c.stats.paidWeek, stats.paidWeek],
          [c.stats.depositsWeek, formatVnd(stats.depositsWeekVnd, locale)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">{c.stats.upcoming}</h2>
        {stats.upcoming.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{c.stats.none}</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {stats.upcoming.map((u) => (
              <li key={`${u.date}-${u.tourSlug}`}>
                <span className="tabular-nums">{formatShortDay(u.date, locale)}</span> · {title(u.tourSlug)} · {u.seats}
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label={c.columns.status}>
        {FILTERS.map((f) => (
          <a key={f} href={query({ filter: f, page: "" })} aria-current={f === filter ? "page" : undefined} className={`rounded-full border px-3 py-1 ${f === filter ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
            {c.filters[f]}
          </a>
        ))}
      </nav>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={sp.q} placeholder={c.search} aria-label={c.search} className={`${input} w-64`} />
        <select name="tour" defaultValue={tour ?? ""} aria-label={c.tour} className={input}>
          <option value="">{c.allTours}</option>
          {tours.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={source ?? ""} aria-label={c.source} className={input}>
          <option value="">{c.allSources}</option>
          {BOOKING_SOURCES.map((s) => (
            <option key={s} value={s}>
              {c.sources[s]}
            </option>
          ))}
        </select>
        <label className="grid text-xs text-muted-foreground">
          {c.from}
          <input type="date" name="from" defaultValue={sp.from} className={input} />
        </label>
        <label className="grid text-xs text-muted-foreground">
          {c.to}
          <input type="date" name="to" defaultValue={sp.to} className={input} />
        </label>
        <button type="submit" className="h-10 rounded-md border border-border px-4 text-sm hover:bg-muted">
          {c.apply}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="bookings-table">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">{c.columns.code}</th>
              <th className="py-2 pr-4 font-medium">{c.columns.date}</th>
              <th className="py-2 pr-4 font-medium">{c.columns.guest}</th>
              <th className="py-2 pr-4 font-medium">{c.columns.seats}</th>
              <th className="py-2 pr-4 font-medium">{c.columns.total}</th>
              <th className="py-2 font-medium">{c.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="py-2 pr-4 font-mono">
                  <a href={localePath(locale, `/admin/bookings/${b.code}`)} className="underline-offset-2 hover:underline">
                    {b.code}
                  </a>
                </td>
                <td className="py-2 pr-4">
                  <span className="whitespace-nowrap tabular-nums">{formatShortDay(b.date, locale)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {title(b.tourSlug)}
                    {b.kind === "private" && <strong className="ml-1 font-semibold text-foreground">· {c.privateTour}</strong>}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {b.name}
                  <span className="block text-xs text-muted-foreground">{b.phone}</span>
                  {b.source !== "website" && (
                    <span className="block text-xs font-medium" data-testid="booking-source">
                      {c.sources[b.source]}
                      {b.externalRef && ` · ${b.externalRef}`}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{b.seats}</td>
                <td className="py-2 pr-4">{formatVnd(b.totalVnd, locale)}</td>
                <td className="py-2">
                  <BookingStatusBadge status={b.status} label={c.filters[b.status]} />
                  {b.refundDueVnd > 0 && !b.refundedAt && (
                    <span className="block text-xs font-semibold text-danger">
                      {c.refundOwed}: {formatVnd(b.refundDueVnd, locale)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">{c.empty}</p>}
      </div>
      <nav className="flex gap-3 text-sm">
        {page > 1 && <a href={query({ page: String(page - 1) })}>← {c.previous}</a>}
        {page * PAGE_SIZE < total && <a href={query({ page: String(page + 1) })}>{c.next} →</a>}
      </nav>
    </div>
  );
}
