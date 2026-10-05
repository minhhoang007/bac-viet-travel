import type { ReactNode } from "react";
import type { Metadata } from "next";
import { productAdminNavFor } from "@/app/_lib/admin";
import { requirePageUser } from "@/app/_lib/session";
import { hasRole } from "@/core/auth";
import { signOut } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { sidebarDefaultOpen } from "@/app/_lib/sidebar";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { productNav } from "@/product/manifest";
import { getContainer } from "@/bootstrap/container";
import { getModuleNavigation } from "@/bootstrap/navigation";

// Default title for pages without their own (documents need a <title>, WCAG 2.4.2).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale as Locale).dashboard.nav.overview, robots: { index: false } };
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { user } = await requirePageUser(locale);
  const c = getAppContent(locale as Locale).dashboard;

  const adminHref = (u: typeof user) =>
    hasRole(u, "admin") ? "/admin" : (productAdminNavFor(u)[0]?.href ?? (hasRole(u, "editor") && getContainer().media ? "/admin/media" : null));
  const nav = [
    { label: c.nav.overview, href: localePath(locale, "/dashboard") },
    ...productNav.map((item) => ({ label: item.label[locale as Locale], href: localePath(locale, item.href) })),
    ...getModuleNavigation().map((item) => ({
      label: typeof item.label === "string" ? item.label : (item.label[locale] ?? Object.values(item.label)[0] ?? ""),
      href: localePath(locale, item.href),
    })),
    { label: c.nav.account, href: localePath(locale, "/dashboard/account") },
    // Admin link for staff only (the admin pages themselves 404 for everyone else). Editors land on their first content page.
    ...(getContainer().admin && adminHref(user) ? [{ label: c.nav.admin, href: localePath(locale, adminHref(user)!) }] : []),
  ];

  return (
    <AppShell
      brand={{ label: appConfig.name, href: localePath(locale, "/dashboard") }}
      nav={nav}
      user={user}
      labels={c.shell}
      defaultOpen={await sidebarDefaultOpen()}
      signOut={
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="rounded border border-border px-2 py-1 hover:bg-muted">
            {c.signOut}
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
