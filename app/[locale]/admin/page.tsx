import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { productAdminNavFor, requireStaff } from "@/app/_lib/admin";
import { hasRole, type Role } from "@/core/auth";
import { BarChart } from "@/components/admin/bar-chart";
import { Stat } from "@/components/admin/stat";
import { formatBytes } from "@/components/ui/format-bytes";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { getAppContent } from "@/content";
import { PageHeader } from "@/components/app-shell/page-header";
import * as productLayout from "@/product/layout";

const DAYS = 30;

// Optional project dashboard at the top of /admin (product/layout.tsx `ProductAdminOverview`), in place of the
// `adminOverview` figures: e.g. a business overview with its own queries, charts and to-do lists.
const ProductAdminOverview =
  "ProductAdminOverview" in productLayout ? (productLayout as { ProductAdminOverview?: (p: { locale: Locale }) => Promise<ReactNode> | ReactNode }).ProductAdminOverview : undefined;
// Optional `productSiteFigures = false`: the project's overview replaces the starter's site figures (sign-ups, views,
// storage) entirely instead of keeping them one click away, when they mean nothing to its staff.
// Optional `productOverviewFor(user)`: staff besides admins (e.g. managers) who see the project's overview here
// instead of being sent to their first page. They get the overview only, never the starter's site figures.
const productOverviewFor =
  "productOverviewFor" in productLayout ? (productLayout as { productOverviewFor?: (user: { id: string; role: Role }) => Promise<boolean> | boolean }).productOverviewFor : undefined;
const showSiteFigures = !("productSiteFigures" in productLayout) || (productLayout as { productSiteFigures?: boolean }).productSiteFigures !== false;

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
  // Staff who are not admins (marketing, sale…) land on their first page instead of a 404.
  // With the second-factor gate: the overview shows revenue and guest names (only the layout skips the gate).
  const staff = await requireStaff("editor");
  if (!hasRole(staff.user, "admin")) {
    if (ProductAdminOverview && (await productOverviewFor?.(staff.user))) {
      return (
        <div className="grid gap-6">
          <PageHeader title={getAppContent(locale).admin.nav.overview} />
          <ProductAdminOverview locale={locale} />
        </div>
      );
    }
    const first = (await productAdminNavFor(staff.user))[0];
    if (!first) notFound();
    redirect(localePath(locale, first.href));
  }
  // An admin (checked above), past the gate: the same context.
  const { admin, container } = staff;
  const c = getAppContent(locale).admin.overview;

  const [signups, users, pro, stats, storage, product] = await Promise.all([
    admin.signupsByDay(DAYS),
    admin.listUsers({ pageSize: 1 }),
    container.entitlements?.countActiveOwners("pro"),
    container.analytics?.stats(DAYS),
    container.storage?.totals(),
    ProductAdminOverview ? [] : (container.app?.adminOverview?.(locale) ?? []),
  ]);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  const figures = (
    <>
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
    </>
  );

  return (
    <div className="grid gap-6">
      <PageHeader title={getAppContent(locale).admin.nav.overview} description={ProductAdminOverview ? undefined : c.last30Days} />
      {ProductAdminOverview && <ProductAdminOverview locale={locale} />}
      {product.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="product-stats">
          {product.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} href={s.href && localePath(locale, s.href)} />
          ))}
        </div>
      )}
      {ProductAdminOverview && !showSiteFigures ? null : ProductAdminOverview ? (
        // The project's own overview comes first; the starter's site figures stay one click away.
        <details className="rounded-lg border border-border p-4" data-testid="site-figures">
          <summary className="cursor-pointer font-semibold">{c.siteFigures}</summary>
          <div className="mt-4 grid gap-6">{figures}</div>
        </details>
      ) : (
        figures
      )}
    </div>
  );
}
