import { ArrowRight, CalendarClock, CircleDollarSign, Clock, Landmark, Undo2, Users } from "lucide-react";
import type { ReactNode } from "react";
import { BarChart } from "@/components/admin/bar-chart";
import { Stat, type StatDelta } from "@/components/admin/stat";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { getBookingAdminContent } from "../booking/admin-content";
import { formatShortDay, formatVnd } from "../booking/content";
import type { DashboardData } from "../booking/dashboard";
import { getDashboardContent } from "../booking/dashboard-content";
import { BookingStatusBadge } from "./booking-status-badge";

// min-w-0: a grid item may shrink below its content (the 30-bar chart), so nothing overflows on phones.
const card = "min-w-0 rounded-lg border border-border bg-background p-4 sm:p-5";

function Card({ title, action, children, testId }: { title: string; action?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className={card} data-testid={testId}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
const trend = (diff: number): StatDelta["trend"] => (diff > 0 ? "up" : diff < 0 ? "down" : "flat");
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Business overview at the top of /admin: figures, to-do queue, money chart, departures and latest bookings. */
export function AdminDashboard({ locale, data, tourTitle }: { locale: Locale; data: DashboardData; tourTitle: (slug: string) => string }) {
  const c = getDashboardContent(locale);
  const statuses = getBookingAdminContent(locale).filters as Record<string, string>;
  const href = (path: string) => localePath(locale, path);
  const money = (v: number) => formatVnd(v, locale);

  const monthPct = pct(data.collected.month, data.collected.previous);
  const weekDiff = data.bookings7d.count - data.bookings7d.previousCount;
  const fillPct = data.fill30d.capacity > 0 ? Math.round((data.fill30d.sold / data.fill30d.capacity) * 100) : 0;

  const queue = [
    { key: "transfers", n: data.queue.transfers, icon: Landmark, to: "/admin/bookings?filter=attention" },
    { key: "toConfirm", n: data.queue.toConfirm, icon: CircleDollarSign, to: "/admin/bookings?filter=deposit_paid" },
    { key: "refunds", n: data.queue.refunds, icon: Undo2, to: "/admin/bookings?filter=refund_due" },
    { key: "expiringHolds", n: data.queue.expiringHolds, icon: Clock, to: "/admin/bookings?filter=held" },
    { key: "lowFill", n: data.queue.lowFill, icon: Users, to: "/admin/departures" },
  ] as const;
  const pending = queue.filter((q) => q.n > 0);
  const maxTour = Math.max(1, ...data.byTour.map((t) => t.vnd));
  const total30 = data.daily.reduce((a, d) => a + d.vnd, 0);

  return (
    <div className="grid gap-6" data-testid="admin-dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="product-stats">
        <Stat
          label={c.kpi.collected}
          value={money(data.collected.month)}
          href={href("/admin/reports")}
          delta={monthPct === null ? { label: c.noBaseline, trend: "flat" } : { label: c.vsLastMonth(`${signed(monthPct)}%`), trend: trend(monthPct) }}
        />
        <Stat label={c.kpi.bookings} value={data.bookings7d.count} href={href("/admin/bookings?filter=all")} delta={{ label: c.vsLastWeek(signed(weekDiff)), trend: trend(weekDiff) }} />
        <Stat label={c.kpi.value} value={money(data.bookings7d.value)} href={href("/admin/bookings?filter=all")} />
        <Stat label={c.kpi.fill} value={`${fillPct}%`} hint={c.seats(data.fill30d.sold, data.fill30d.capacity)} href={href("/admin/departures")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title={c.queueTitle} testId="dashboard-queue">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.queueEmpty}</p>
          ) : (
            <ul className="grid gap-2">
              {pending.map((q) => (
                <li key={q.key}>
                  <a href={href(q.to)} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:border-primary/60" data-queue={q.key}>
                    <q.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{c.queue[q.key]}</span>
                    <span className="min-w-7 rounded-full bg-primary px-2 py-0.5 text-center text-xs font-semibold text-primary-foreground tabular-nums">{q.n}</span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={c.revenueTitle} action={<span className="text-sm text-muted-foreground tabular-nums">{c.revenueTotal(money(total30))}</span>} testId="dashboard-revenue">
          <BarChart label={c.revenueTitle} data={data.daily.map((d) => ({ label: `${formatShortDay(d.day, locale)} · ${money(d.vnd)}`, value: d.vnd }))} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{formatShortDay(data.daily[0]!.day, locale)}</span>
            <span>{formatShortDay(data.daily.at(-1)!.day, locale)}</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={c.upcomingTitle} action={<a href={href("/admin/departures")} className="text-sm text-primary underline underline-offset-4">{c.all}</a>} testId="dashboard-upcoming">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.upcomingEmpty}</p>
          ) : (
            <ul className="grid gap-3">
              {data.upcoming.map((d) => {
                const share = Math.min(100, Math.round((d.sold / d.capacity) * 100));
                return (
                  <li key={d.id}>
                    <a href={href(`/admin/departures/${d.id}`)} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 rounded-md px-1 py-1 hover:bg-muted">
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="font-medium tabular-nums">{formatShortDay(d.date, locale)}</span>
                          <span className="truncate text-muted-foreground">{tourTitle(d.tourSlug)}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{c.seats(d.sold, d.capacity)}</span>
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className={`block h-full rounded-full ${share < 50 ? "bg-warning" : "bg-primary"}`} style={{ width: `${share}%` }} />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={c.byTourTitle} testId="dashboard-tours">
          {data.byTour.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.noData}</p>
          ) : (
            <ul className="grid gap-3">
              {data.byTour.map((t) => (
                <li key={t.tourSlug} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{tourTitle(t.tourSlug)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.bookingsCount(t.count)} · <span className="text-foreground">{money(t.vnd)}</span>
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((t.vnd / maxTour) * 100))}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={c.recentTitle} action={<a href={href("/admin/bookings?filter=all")} className="text-sm text-primary underline underline-offset-4">{c.all}</a>} testId="dashboard-recent">
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.noData}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm [&_td]:whitespace-nowrap">
              <tbody>
                {data.recent.map((b) => (
                  <tr key={b.code} className="border-t border-border first:border-t-0">
                    <td className="px-1 py-2">
                      <a href={href(`/admin/bookings/${b.code}`)} className="font-mono font-medium text-primary underline-offset-4 hover:underline">
                        {b.code}
                      </a>
                    </td>
                    <td className="px-1 py-2">{b.name}</td>
                    <td className="max-w-48 truncate px-1 py-2 text-muted-foreground">{tourTitle(b.tourSlug)}</td>
                    <td className="px-1 py-2">
                      <BookingStatusBadge status={b.status as never} label={statuses[b.status] ?? b.status} />
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums">{money(b.totalVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
