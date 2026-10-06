import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { formatContentDate } from "@/app/_components/workflow-panel";
import { POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { requirePostsAdmin } from "./_shared";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).admin.posts.title };
}

export default async function AdminPostsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { content } = await requirePostsAdmin();
  const admin = getAppContent(locale).admin;
  const c = admin.posts;
  const { rows } = await content.list({ type: POST_CONTENT_TYPE, pageSize: 100 });
  const newPost = <ButtonLink href={localePath(locale, "/admin/posts/new")}>{c.newPost}</ButtonLink>;
  const field = (data: Record<string, unknown>, key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");

  return (
    <div className="grid gap-6">
      <PageHeader title={c.title} description={c.description} actions={newPost} />
      {rows.length === 0 ? (
        <EmptyState title={c.empty} action={newPost} />
      ) : (
        <Table data-testid="admin-posts">
          <TableHeader>
            <TableRow>
              <TableHead>{c.columns.post}</TableHead>
              <TableHead>{c.columns.locale}</TableHead>
              <TableHead>{c.columns.status}</TableHead>
              <TableHead>{c.columns.live}</TableHead>
              <TableHead>{c.columns.updated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id} data-slug={item.slug}>
                <TableCell>
                  <a href={localePath(locale, `/admin/posts/${item.id}`)} className="font-medium hover:underline">
                    {field(item.draft, "title") || item.slug}
                  </a>
                  <div className="text-xs text-muted-foreground">/{item.slug}</div>
                </TableCell>
                <TableCell>{c.locales[field(item.draft, "locale")] ?? "—"}</TableCell>
                <TableCell data-status={item.status}>{admin.content.statuses[item.status]}</TableCell>
                <TableCell>{item.hidden ? c.hidden : item.published ? c.yes : c.no}</TableCell>
                <TableCell className="whitespace-nowrap">{formatContentDate(item.updatedAt, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
