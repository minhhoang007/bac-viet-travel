import type { ReactNode } from "react";
import type { Metadata } from "next";
import { productAdminNavFor, requireStaff } from "@/app/_lib/admin";
import { hasRole } from "@/core/auth";
import { signOut } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { sidebarDefaultOpen } from "@/app/_lib/sidebar";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

// Default title for pages without their own (documents need a <title>, WCAG 2.4.2).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale as Locale).admin.title, robots: { index: false } };
}

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Editors see the layout with their content pages only; every starter admin page still requires an admin.
  const { user, container } = await requireStaff("editor");
  const isAdmin = hasRole(user, "admin");
  const content = getAppContent(locale as Locale);
  const c = content.admin;
  const href = (path: string) => localePath(locale, path);

  // Pages for optional modules appear only when the module is on.
  // Content pages: editors and admins.
  const contentNav = [
    ...(container.content ? [{ label: c.nav.content, href: href("/admin/content") }] : []),
    ...(container.media ? [{ label: c.nav.media, href: href("/admin/media") }] : []),
  ];
  const product = [...productAdminNavFor(user).map((item) => ({ label: item.label[locale as Locale], href: href(item.href) })), ...contentNav];
  const nav = isAdmin
    ? [
        { label: c.nav.overview, href: href("/admin") },
        { label: c.nav.users, href: href("/admin/users") },
        ...(container.jobs ? [{ label: c.nav.jobs, href: href("/admin/jobs") }] : []),
        ...(container.billing ? [{ label: c.nav.billing, href: href("/admin/billing") }] : []),
        ...product,
        { label: c.nav.audit, href: href("/admin/audit") },
        { label: c.backToApp, href: href("/dashboard") },
      ]
    : [...product, { label: c.backToApp, href: href("/dashboard") }];

  return (
    <AppShell
      brand={{ label: c.title, href: isAdmin ? href("/admin") : (product[0]?.href ?? href("/dashboard")) }}
      nav={nav}
      user={user}
      labels={content.dashboard.shell}
      defaultOpen={await sidebarDefaultOpen()}
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
    </AppShell>
  );
}
