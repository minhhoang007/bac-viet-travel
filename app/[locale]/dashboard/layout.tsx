import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requirePageUser } from "@/app/_lib/session";
import { signOut } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { productNav } from "@/product/manifest";
import { getModuleNavigation } from "@/bootstrap/navigation";

export const metadata: Metadata = { robots: { index: false } };

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

  const nav = [
    { label: c.nav.overview, href: localePath(locale, "/dashboard") },
    ...productNav.map((item) => ({ label: c.nav[item.labelKey], href: localePath(locale, item.href) })),
    ...getModuleNavigation().map((item) => ({ label: item.label, href: localePath(locale, item.href) })),
    { label: c.nav.account, href: localePath(locale, "/dashboard/account") },
  ];

  return (
    <DashboardShell
      brand={{ label: appConfig.name, href: localePath(locale, "/dashboard") }}
      nav={nav}
      user={user}
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
    </DashboardShell>
  );
}
