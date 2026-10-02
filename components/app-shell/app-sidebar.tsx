"use client";

import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export interface AppNavItem {
  label: string;
  href: string;
}

/** Active item: the longest href that is the current path or a parent of it (so /dashboard is not active on /dashboard/account). */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function AppSidebar({ brand, nav, mobileTitle }: { brand: AppNavItem; nav: AppNavItem[]; mobileTitle: string }) {
  const pathname = usePathname();
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
        <SidebarGroup>
          <nav aria-label={mobileTitle}>
            <SidebarMenu>
              {nav.map((item) => (
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
          </nav>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
