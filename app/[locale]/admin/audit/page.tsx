import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

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
      <h1 className="text-2xl font-bold">{c.audit.title}</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.audit.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="audit-log">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">{c.audit.time}</th>
                <th className="py-2 pr-4 font-medium">{c.audit.actor}</th>
                <th className="py-2 pr-4 font-medium">{c.audit.action}</th>
                <th className="py-2 font-medium">{c.audit.target}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{a.createdAt.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</td>
                  <td className="py-2 pr-4">{a.actorEmail}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{a.action}</td>
                  <td className="py-2">
                    {a.targetType === "user" ? (
                      <a href={localePath(locale, `/admin/users/${a.targetId}`)} className="hover:underline">
                        {a.targetType}:{a.targetId.slice(0, 8)}
                      </a>
                    ) : (
                      `${a.targetType}:${a.targetId.slice(0, 8)}`
                    )}
                    {Object.keys(a.metadata).length > 0 && <span className="ml-2 text-muted-foreground">{JSON.stringify(a.metadata)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="flex gap-3 text-sm">
        {page > 1 && <a href={pageHref(page - 1)}>←</a>}
        {page * PAGE_SIZE < total && <a href={pageHref(page + 1)}>→</a>}
      </nav>
    </div>
  );
}
