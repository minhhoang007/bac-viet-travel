import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { setUserRole, setUserStatus } from "@/app/actions/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import { formatBytes } from "@/components/ui/format-bytes";
import type { Locale } from "@/config/app";
import { billingConfig } from "@/config/billing";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ result?: string }> };

const button = "h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted";

export default async function AdminUserPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { result } = await searchParams;
  setRequestLocale(locale);
  const { admin, user: me, container } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await admin.getUser(id);
  if (!user) notFound();
  const c = getAppContent(locale).admin;
  const date = (d: Date) => d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US");

  const [access, billing, files, audit] = await Promise.all([
    container.entitlements?.getAccess(id),
    container.billing?.exportForUser(id),
    container.storage?.usage(id),
    admin.listAudit({ targetId: id, pageSize: 20 }),
  ]);
  const self = me.id === id;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
    </>
  );

  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold break-all">{user.email}</h1>
      <ResultNotice result={result} done={c.done} failed={c.failed} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{c.users.role}</dt>
        <dd data-testid="user-role">{user.role}</dd>
        <dt className="text-muted-foreground">{c.users.status}</dt>
        <dd data-testid="user-status">{user.status}</dd>
        <dt className="text-muted-foreground">{c.users.createdAt}</dt>
        <dd>{date(user.createdAt)}</dd>
        {access && (
          <>
            <dt className="text-muted-foreground">{c.users.plan}</dt>
            <dd>
              {billingConfig.plans[access.plan].name[locale]}
              {access.endsAt && ` · ${c.users.activeUntil} ${date(access.endsAt)}`}
            </dd>
          </>
        )}
        {files && (
          <>
            <dt className="text-muted-foreground">{c.users.files}</dt>
            <dd>
              {formatBytes(files.usedBytes)} / {formatBytes(files.quotaBytes)}
            </dd>
          </>
        )}
      </dl>

      {self ? (
        <p className="text-sm text-muted-foreground">{c.users.selfNote}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <form action={setUserStatus}>
            {hidden}
            <input type="hidden" name="status" value={user.status === "active" ? "disabled" : "active"} />
            <button type="submit" className={button}>
              {user.status === "active" ? c.users.disable : c.users.enable}
            </button>
          </form>
          <form action={setUserRole}>
            {hidden}
            <input type="hidden" name="role" value={user.role === "admin" ? "user" : "admin"} />
            <button type="submit" className={button}>
              {user.role === "admin" ? c.users.makeUser : c.users.makeAdmin}
            </button>
          </form>
        </div>
      )}

      {billing && (billing.orders.length > 0 || billing.subscriptions.length > 0) && (
        <section>
          <h2 className="font-semibold">
            {c.users.orders} / {c.users.subscriptions}
          </h2>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(billing, null, 2)}</pre>
        </section>
      )}

      <section>
        <h2 className="font-semibold">{c.audit.title}</h2>
        {audit.rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{c.audit.empty}</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {audit.rows.map((a) => (
              <li key={a.id}>
                {a.createdAt.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} · {a.actorEmail} · {a.action}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
