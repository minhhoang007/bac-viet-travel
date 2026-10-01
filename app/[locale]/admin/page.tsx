import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { BarChart } from "@/components/admin/bar-chart";
import { Stat } from "@/components/admin/stat";
import { formatBytes } from "@/components/ui/format-bytes";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

const DAYS = 30;

function List({ title, rows, empty }: { title: string; rows: { label: string; value: number }[]; empty: string }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-1 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-4">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminOverviewPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin, container } = await requireAdmin();
  const c = getAppContent(locale).admin.overview;

  const [signups, users, pro, stats, storage] = await Promise.all([
    admin.signupsByDay(DAYS),
    admin.listUsers({ pageSize: 1 }),
    container.entitlements?.countActiveOwners("pro"),
    container.analytics?.stats(DAYS),
    container.storage?.totals(),
  ]);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">
        {getAppContent(locale).admin.nav.overview} <span className="text-base font-normal text-muted-foreground">· {c.last30Days}</span>
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={c.totalUsers} value={users.total} />
        <Stat label={c.newUsers} value={sum(signups.map((d) => d.count))} />
        {pro !== undefined && <Stat label={c.proUsers} value={pro} />}
        {stats && <Stat label={c.views} value={sum(stats.daily.map((d) => d.views))} />}
        {storage && <Stat label={c.storage} value={`${formatBytes(storage.bytes)} · ${storage.files}`} />}
      </div>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-semibold">{c.newUsers}</h2>
        <BarChart label={c.newUsers} data={signups.map((d) => ({ label: d.day, value: d.count }))} />
      </section>

      {stats && (
        <>
          <section className="rounded-lg border border-border p-4">
            <h2 className="font-semibold">{c.views}</h2>
            <BarChart label={c.views} data={stats.daily.map((d) => ({ label: d.day, value: d.views }))} />
            <p className="mt-2 text-sm text-muted-foreground">
              {c.visitors}: {sum(stats.daily.map((d) => d.visitors))}
            </p>
          </section>
          <div className="grid gap-4 lg:grid-cols-3">
            <List title={c.topPages} rows={stats.topPages.map((r) => ({ label: r.path, value: r.views }))} empty={c.noData} />
            <List title={c.topReferrers} rows={stats.topReferrers.map((r) => ({ label: r.host, value: r.views }))} empty={c.noData} />
            <List title={c.events} rows={stats.events.map((r) => ({ label: r.name, value: r.count }))} empty={c.noData} />
          </div>
        </>
      )}
    </div>
  );
}
