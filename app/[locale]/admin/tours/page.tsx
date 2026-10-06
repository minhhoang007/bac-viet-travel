import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/app/_lib/admin";
import { formatContentDate } from "@/app/_components/workflow-panel";
import { duplicateTour } from "@/app/actions/tours";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getTourAdminContent } from "@/product/tours/admin-content";
import { tourProblems } from "@/product/tours/document";
import { TOUR_CONTENT_TYPE } from "@/product/tours/source";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getTourAdminContent(locale).title };
}

export default async function AdminToursPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireStaff("editor");
  const content = container.content;
  if (!content) notFound();
  const c = getTourAdminContent(locale);
  const statuses = getAppContent(locale).admin.content.statuses;
  const { rows } = await content.list({ type: TOUR_CONTENT_TYPE, pageSize: 100 });
  const { result } = await searchParams;
  const titleOf = (draft: Record<string, unknown>, slug: string) => {
    const t = (draft[locale] as { title?: unknown } | undefined)?.title ?? (draft.vi as { title?: unknown } | undefined)?.title;
    return typeof t === "string" && t ? t : slug;
  };

  return (
    <div className="grid gap-6">
      <PageHeader title={c.title} description={c.description} actions={<ButtonLink href={localePath(locale, "/admin/tours/new")}>{c.newTour}</ButtonLink>} />
      {result === "failed" && <Notice tone="danger">{getAppContent(locale).admin.failed}</Notice>}
      {rows.length === 0 ? (
        <EmptyState title={c.empty} action={<ButtonLink href={localePath(locale, "/admin/tours/new")}>{c.newTour}</ButtonLink>} />
      ) : (
        <Table data-testid="admin-tours">
          <TableHeader>
            <TableRow>
              <TableHead>{c.columns.tour}</TableHead>
              <TableHead>{c.columns.status}</TableHead>
              <TableHead>{c.columns.live}</TableHead>
              <TableHead>{c.columns.missing}</TableHead>
              <TableHead>{c.columns.updated}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => {
              const missing = tourProblems(item.draft).length;
              return (
                <TableRow key={item.id} data-slug={item.slug}>
                  <TableCell>
                    <a href={localePath(locale, `/admin/tours/${item.id}`)} className="font-medium hover:underline">
                      {titleOf(item.draft, item.slug)}
                    </a>
                    <div className="text-xs text-muted-foreground">/{item.slug}</div>
                  </TableCell>
                  <TableCell data-status={item.status}>{statuses[item.status]}</TableCell>
                  <TableCell>{item.hidden ? c.hidden : item.published ? c.yes : c.no}</TableCell>
                  <TableCell className={missing ? "text-danger" : "text-success"}>{missing ? c.missingCount(missing) : c.complete}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatContentDate(item.updatedAt, locale)}</TableCell>
                  <TableCell>
                    <form action={duplicateTour}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton label={c.duplicate} variant="outline" size="sm" />
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
