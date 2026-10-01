import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/app/_lib/admin";
import { signOut } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import * as manifest from "@/product/manifest";
import type { ProductNavItem } from "@/product/manifest";

// Projects created before rc.11 have no productAdminNav export.
const productAdminNav = (manifest as { productAdminNav?: ProductNavItem[] }).productAdminNav ?? [];

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { user, container } = await requireAdmin();
  const content = getAppContent(locale as Locale);
  const c = content.admin;
  const href = (path: string) => localePath(locale, path);

  // Pages for optional modules appear only when the module is on.
  const nav = [
    { label: c.nav.overview, href: href("/admin") },
    { label: c.nav.users, href: href("/admin/users") },
    ...(container.jobs ? [{ label: c.nav.jobs, href: href("/admin/jobs") }] : []),
    ...(container.billing ? [{ label: c.nav.billing, href: href("/admin/billing") }] : []),
    ...productAdminNav.map((item) => ({ label: item.label[locale as Locale], href: href(item.href) })),
    { label: c.nav.audit, href: href("/admin/audit") },
    { label: c.backToApp, href: href("/dashboard") },
  ];

  return (
    <DashboardShell
      brand={{ label: c.title, href: href("/admin") }}
      nav={nav}
      user={user}
      signOut={
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="rounded border border-border px-2 py-1 hover:bg-muted">
            {content.dashboard.signOut}
          </button>
        </form>
      }
    >
      {children}
    </DashboardShell>
  );
}
