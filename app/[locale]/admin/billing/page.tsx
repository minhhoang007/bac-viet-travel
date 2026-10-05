import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { retryWebhookEvent } from "@/app/actions/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { SubmitButton } from "@/components/forms/submit-button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

function RowsTable({ head, rows, empty }: { head: string[]; rows: (string | number | null)[][]; empty: string }) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head.map((h) => (
            <TableHead key={h}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j}>
                {cell ?? "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
          <EmptyState title={c.billing.empty} />
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
                  <SubmitButton label={c.billing.retry} variant="outline" size="sm" />
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{c.billing.subscriptions}</h2>
        <RowsTable
          head={[c.users.email, c.users.plan, c.users.status, c.users.activeUntil]}
          rows={data.subscriptions.map((s) => [s.ownerEmail, s.plan, s.cancelAtPeriodEnd ? `${s.status} (cancel)` : s.status, date(s.currentPeriodEnd)])}
          empty={c.billing.empty}
        />
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{c.billing.orders}</h2>
        <RowsTable
          head={[c.users.email, c.users.plan, c.users.status, c.users.createdAt]}
          rows={data.orders.map((o) => [o.ownerEmail, `${o.plan}/${o.interval} · ${o.amount.toLocaleString("vi-VN")} ${o.currency}`, o.status, date(o.createdAt)])}
          empty={c.billing.empty}
        />
      </section>
    </div>
  );
}
