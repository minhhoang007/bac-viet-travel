import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/app/_lib/admin";
import { productContentTypes } from "@/bootstrap/container";
import { PageHeader } from "@/components/app-shell/page-header";
import { formatContentDate } from "@/app/_components/workflow-panel";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
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
  const types = productContentTypes();
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
        <p className="text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">{c.slug}</th>
                <th className="py-2 pr-4">{c.type}</th>
                <th className="py-2 pr-4">{c.status}</th>
                <th className="py-2">{c.updated}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const type = types[item.type];
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2 pr-4">
                      {type ? (
                        <a href={localePath(locale, type.adminPath(item.id))} className="font-medium hover:underline">
                          {item.slug}
                        </a>
                      ) : (
                        item.slug
                      )}
                    </td>
                    <td className="py-2 pr-4">{type?.label[locale] ?? item.type}</td>
                    <td className="py-2 pr-4" data-status={item.status}>
                      {c.statuses[item.status]}
                      {item.status === "approved" && item.publishAt ? ` · ${formatContentDate(item.publishAt, locale)}` : ""}
                      {item.hidden ? ` · ${c.hidden}` : ""}
                    </td>
                    <td className="py-2">{formatContentDate(item.updatedAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
