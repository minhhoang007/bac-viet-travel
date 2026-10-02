import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { retryWebhookEvent } from "@/app/actions/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { PageHeader } from "@/components/app-shell/page-header";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

function Table({ head, rows, empty }: { head: string[]; rows: (string | number | null)[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4">
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminBillingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { result } = await searchParams;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  if (!container.billing) notFound();
  const c = getAppContent(locale).admin;
  const data = await container.billing.adminOverview(50);
  const date = (d: Date | null) => (d ? d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US") : null);

  return (
    <div className="grid gap-8">
      <PageHeader title={c.nav.billing} />
      <ResultNotice result={result} done={c.done} failed={c.failed} />

      <section className="grid gap-2">
        <h2 className="font-semibold">{c.billing.problemEvents}</h2>
        {data.problemEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.billing.empty}</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {data.problemEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                <span className="font-mono text-xs">{e.type}</span>
                <span>{e.status}</span>
                <span className="text-muted-foreground">×{e.attempts}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.lastError}</span>
                <form action={retryWebhookEvent}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className="rounded border border-border px-3 py-1 hover:bg-muted">
                    {c.billing.retry}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{c.billing.subscriptions}</h2>
        <Table
          head={[c.users.email, c.users.plan, c.users.status, c.users.activeUntil]}
          rows={data.subscriptions.map((s) => [s.ownerEmail, s.plan, s.cancelAtPeriodEnd ? `${s.status} (cancel)` : s.status, date(s.currentPeriodEnd)])}
          empty={c.billing.empty}
        />
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{c.billing.orders}</h2>
        <Table
          head={[c.users.email, c.users.plan, c.users.status, c.users.createdAt]}
          rows={data.orders.map((o) => [o.ownerEmail, `${o.plan}/${o.interval} · ${o.amount.toLocaleString("vi-VN")} ${o.currency}`, o.status, date(o.createdAt)])}
          empty={c.billing.empty}
        />
      </section>
    </div>
  );
}
