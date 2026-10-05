import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";

const PAGE_SIZE = 50;

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ page?: string }> };

export default async function AdminAuditPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale);
  const { admin } = await requireAdmin();
  const c = getAppContent(locale).admin;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const { rows, total } = await admin.listAudit({ page, pageSize: PAGE_SIZE });
  const pageHref = (p: number) => localePath(locale, `/admin/audit?page=${p}`);

  return (
    <div className="grid gap-6">
      <PageHeader title={c.audit.title} />
      {rows.length === 0 ? (
        <EmptyState title={c.audit.empty} />
      ) : (
        <Table data-testid="audit-log">
          <TableHeader>
            <TableRow>
              <TableHead>{c.audit.time}</TableHead>
              <TableHead>{c.audit.actor}</TableHead>
              <TableHead>{c.audit.action}</TableHead>
              <TableHead>{c.audit.target}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} className="align-top">
                <TableCell className="whitespace-nowrap">{a.createdAt.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</TableCell>
                <TableCell>{a.actorEmail}</TableCell>
                <TableCell className="font-mono text-xs">{a.action}</TableCell>
                <TableCell>
                  {a.targetType === "user" ? (
                    <a href={localePath(locale, `/admin/users/${a.targetId}`)} className="hover:underline">
                      {a.targetType}:{a.targetId.slice(0, 8)}
                    </a>
                  ) : (
                    `${a.targetType}:${a.targetId.slice(0, 8)}`
                  )}
                  {Object.keys(a.metadata).length > 0 && <span className="ml-2 text-muted-foreground">{JSON.stringify(a.metadata)}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <nav className="flex gap-3 text-sm">
        {page > 1 && <a href={pageHref(page - 1)}>←</a>}
        {page * PAGE_SIZE < total && <a href={pageHref(page + 1)}>→</a>}
      </nav>
    </div>
  );
}
