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
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

// Default title for pages without their own (documents need a <title>, WCAG 2.4.2).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale as Locale).admin.title, robots: { index: false } };
}

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Editors see the layout with their content pages only; every starter admin page still requires an admin.
  const { user, container } = await requireStaff("editor", { secondFactor: false });
  const isAdmin = hasRole(user, "admin");
  const content = getAppContent(locale as Locale);
  const c = content.admin;
  const href = (path: string) => localePath(locale, path);

  // Menu sections: the business pages first, then content, settings, and the technical pages last (admins only).
  const groups = { main: undefined, content: c.navGroups.content, settings: c.navGroups.settings, system: c.navGroups.system };
  // Pages for optional modules appear only when the module is on.
  // Content pages: editors and admins.
  const contentNav = [
    ...(container.content ? [{ label: c.nav.content, href: href("/admin/content"), group: groups.content }] : []),
    ...(container.media ? [{ label: c.nav.media, href: href("/admin/media"), group: groups.content }] : []),
    ...(container.content && features.blog && blogConfig.source === "content" ? [{ label: c.nav.posts, href: href("/admin/posts"), group: groups.content }] : []),
  ];
  // `group` is optional in the project's ProductNavItem (projects from before v1.23 do not declare it).
  const groupOf = (item: object): keyof typeof groups => {
    const group = (item as { group?: unknown }).group;
    return group === "content" || group === "settings" ? group : "main";
  };
  const productItems = (await productAdminNavFor(user)).map((item) => ({ label: item.label[locale as Locale], href: href(item.href), group: groups[groupOf(item)] }));
  const inGroup = (group: string | undefined) => productItems.filter((item) => item.group === group);
  // Demo site: the mailbox of emails that were not sent, for every staff member trying the admin.
  const demoNav = container.demoMailbox ? [{ label: content.demo.mailbox.nav, href: href("/admin/demo-mail") }] : [];
  const product = [...inGroup(groups.main), ...demoNav, ...inGroup(groups.content), ...contentNav, ...inGroup(groups.settings)];
  const nav = isAdmin
    ? [
        { label: c.nav.overview, href: href("/admin") },
        ...(container.billing ? [{ label: c.nav.billing, href: href("/admin/billing") }] : []),
        ...product,
        { label: c.nav.users, href: href("/admin/users"), group: groups.system },
        ...(container.jobs ? [{ label: c.nav.jobs, href: href("/admin/jobs"), group: groups.system }] : []),
        { label: c.nav.audit, href: href("/admin/audit"), group: groups.system },
        { label: c.backToApp, href: href("/dashboard"), group: groups.system },
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
