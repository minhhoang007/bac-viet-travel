"use client";

import { usePathname } from "next/navigation";
import { useId } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export interface AppNavItem {
  label: string;
  href: string;
  /** Section title; items without one form the first, untitled section. */
  group?: string;
}

/** Sections in the order their first item appears; items keep their order inside a section. */
export function groupNav(items: AppNavItem[]): { title?: string; items: AppNavItem[] }[] {
  const sections: { title?: string; items: AppNavItem[] }[] = [];
  for (const item of items) {
    const section = sections.find((s) => s.title === item.group);
    if (section) section.items.push(item);
    else sections.push({ title: item.group, items: [item] });
  }
  return sections;
}

/** Active item: the longest href that is the current path or a parent of it (so /dashboard is not active on /dashboard/account). */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function AppSidebar({ brand, nav, mobileTitle }: { brand: AppNavItem; nav: AppNavItem[]; mobileTitle: string }) {
  const pathname = usePathname();
  const groupId = useId();
  const { setOpenMobile } = useSidebar();
  const active = activeHref(pathname, nav.map((item) => item.href));

  return (
    // absolute + h-auto: stay inside the shell box (see AppShell) instead of fixed to the viewport.
    <Sidebar mobileTitle={mobileTitle} className="absolute h-auto">
      <SidebarHeader>
        <a href={brand.href} className="px-2 py-1 font-semibold">
          {brand.label}
        </a>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={mobileTitle}>
          {groupNav(nav).map((section, i) => (
            <SidebarGroup key={section.title ?? `section-${i}`}>
              {section.title && <SidebarGroupLabel id={`${groupId}-${i}`}>{section.title}</SidebarGroupLabel>}
              <SidebarMenu aria-labelledby={section.title ? `${groupId}-${i}` : undefined}>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={item.href === active}>
                      <a
                        href={item.href}
                        aria-current={item.href === active ? "page" : undefined}
                        onClick={() => setOpenMobile(false)}
                      >
                        {item.label}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
