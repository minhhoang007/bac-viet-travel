import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { removeStaff, setStaffRole } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/app";
import { ConfirmButton } from "@/product/components/confirm-button";
import { STAFF_ROLES } from "@/product/staff/permissions";
import { getStaffContent } from "@/product/staff/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getStaffContent((await params).locale).title };
}

const input = "h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm";

/** Staff roles for booking work (H2): admins add an existing account as manager or sales, or remove it. */
export default async function StaffPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin, container } = await requireAdmin();
  const c = getStaffContent(locale);
  const rows = await container.app!.product.staff.list();
  const users = await Promise.all(rows.map((r) => admin.getUser(r.userId)));
  const { result } = await searchParams;
  const hidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{c.intro}</p>
      </div>
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          {c.result[result] ?? c.result.failed}
        </p>
      )}

      <form action={setStaffRole} className="grid max-w-2xl gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end [&>*]:min-w-0" data-testid="staff-form">
        {hidden}
        <label className="grid gap-1 text-sm">
          {c.email}
          <input name="email" type="email" required className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.role}
          <select name="role" defaultValue="sale" className={input}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {c.roles[r]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">{c.add}</Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <table className="w-full max-w-2xl text-sm" data-testid="staff-table">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">{c.cols.email}</th>
              <th className="py-2 pr-3 font-medium">{c.cols.role}</th>
              <th className="py-2 pr-3 font-medium">{c.cols.since}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId} className="border-t border-border" data-staff={users[i]?.email ?? r.userId}>
                <td className="py-2 pr-3">{users[i]?.email ?? "—"}</td>
                <td className="py-2 pr-3">{c.roles[r.role]}</td>
                <td className="py-2 pr-3 tabular-nums">{r.createdAt.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
                <td className="py-2">
                  <form action={removeStaff}>
                    {hidden}
                    <input type="hidden" name="userId" value={r.userId} />
                    <ConfirmButton question={c.removeAsk} variant="outline" className="h-8 px-3" aria-label={`${c.remove} ${users[i]?.email ?? ""}`}>
                      {c.remove}
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
