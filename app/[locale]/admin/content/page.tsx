import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/app/_lib/admin";
import { allContentTypes } from "@/bootstrap/container";
import { PageHeader } from "@/components/app-shell/page-header";
import { formatContentDate } from "@/app/_components/workflow-panel";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { CONTENT_STATUSES, type ContentStatus } from "@/modules/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).admin.content.title };
}

/** Review queue across every project content type: pending first by default, links to each item's edit page. */
export default async function ContentQueuePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireStaff("editor");
  const content = container.content;
  if (!content) notFound();
  const c = getAppContent(locale).admin.content;
  const raw = (await searchParams).status;
  const status = raw === "all" ? undefined : CONTENT_STATUSES.includes(raw as ContentStatus) ? (raw as ContentStatus) : raw === undefined ? "pending" : undefined;
  const { rows } = await content.list({ status, pageSize: 100 });
  const types = allContentTypes();
  const filters: { key: string; label: string }[] = [...CONTENT_STATUSES.map((s) => ({ key: s, label: c.statuses[s] })), { key: "all", label: c.all }];
  const current = status ?? "all";

  return (
    <div className="grid gap-6">
      <PageHeader title={c.title} description={c.description} />
      <nav aria-label={c.status} className="flex flex-wrap gap-2 text-sm">
        {filters.map((f) => (
          <a key={f.key} href={localePath(locale, `/admin/content?status=${f.key}`)} aria-current={f.key === current ? "page" : undefined} className="rounded-full border border-border px-3 py-1 hover:bg-muted aria-[current=page]:bg-foreground aria-[current=page]:text-background">
            {f.label}
          </a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c.slug}</TableHead>
              <TableHead>{c.type}</TableHead>
              <TableHead>{c.status}</TableHead>
              <TableHead>{c.updated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => {
              const type = types[item.type];
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    {type ? (
                      <a href={localePath(locale, type.adminPath(item.id))} className="font-medium hover:underline">
                        {item.slug}
                      </a>
                    ) : (
                      item.slug
                    )}
                  </TableCell>
                  <TableCell>{type?.label[locale] ?? item.type}</TableCell>
                  <TableCell data-status={item.status}>
                    {c.statuses[item.status]}
                    {item.status === "approved" && item.publishAt ? ` · ${formatContentDate(item.publishAt, locale)}` : ""}
                    {item.hidden ? ` · ${c.hidden}` : ""}
                  </TableCell>
                  <TableCell>{formatContentDate(item.updatedAt, locale)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
