import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { PageHeader } from "@/components/app-shell/page-header";

const PAGE_SIZE = 25;

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ q?: string; page?: string }> };

export default async function AdminUsersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q = "", page: pageParam } = await searchParams;
  setRequestLocale(locale);
  const { admin } = await requireAdmin();
  const c = getAppContent(locale).admin;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const query = q.trim().slice(0, 100);
  const { rows, total } = await admin.listUsers({ query: query || undefined, page, pageSize: PAGE_SIZE });
  const pageHref = (p: number) => localePath(locale, `/admin/users?${new URLSearchParams({ ...(query && { q: query }), page: String(p) })}`);
  const date = (d: Date) => d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US");

  return (
    <div className="grid gap-6">
      <PageHeader
        title={
          <>
            {c.nav.users} <span className="text-base font-normal text-muted-foreground">({total})</span>
          </>
        }
      />
      <form method="get" className="flex max-w-md gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder={c.users.search}
          aria-label={c.users.search}
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <button type="submit" className="h-10 rounded-md border border-border px-4 text-sm hover:bg-muted">
          {c.users.search}
        </button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">{c.users.email}</th>
              <th className="py-2 pr-4 font-medium">{c.users.role}</th>
              <th className="py-2 pr-4 font-medium">{c.users.status}</th>
              <th className="py-2 font-medium">{c.users.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="py-2 pr-4">
                  <a href={localePath(locale, `/admin/users/${u.id}`)} className="underline-offset-2 hover:underline">
                    {u.email}
                  </a>
                </td>
                <td className="py-2 pr-4">{c.users.roles[u.role]}</td>
                <td className="py-2 pr-4">{u.status}</td>
                <td className="py-2">{date(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex gap-3 text-sm">
        {page > 1 && <a href={pageHref(page - 1)}>← {c.users.previous}</a>}
        {page * PAGE_SIZE < total && <a href={pageHref(page + 1)}>{c.users.next} →</a>}
      </nav>
    </div>
  );
}
