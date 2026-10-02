import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type AppNavItem } from "./app-sidebar";

export type { AppNavItem };

export interface AppShellProps {
  brand: { label: string; href: string };
  /** Menu items, in display order. The current page is highlighted from the URL. */
  nav: AppNavItem[];
  user: { name: string; email: string };
  /** A form (server action) rendering the sign-out button. */
  signOut: ReactNode;
  labels: { menu: string; toggle: string; skip: string };
  /** Sidebar open on first render (read from the cookie with `sidebarDefaultOpen()`). */
  defaultOpen?: boolean;
  children: ReactNode;
}

const CONTENT_ID = "app-content";

/**
 * Layout for signed-in areas (dashboard, admin): collapsible sidebar (a sheet on mobile), a top bar with the
 * user, and the page content. It knows nothing about the product: menus come in through `nav`.
 */
export function AppShell({ brand, nav, user, signOut, labels, defaultOpen = true, children }: AppShellProps) {
  return (
    // The site header and footer stay around the shell, so the sidebar is positioned inside this box
    // instead of fixed to the viewport.
    <SidebarProvider defaultOpen={defaultOpen} className="relative min-h-[calc(100svh-4rem)]">
      <a
        href={`#${CONTENT_ID}`}
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {labels.skip}
      </a>
      <AppSidebar brand={brand} nav={nav} mobileTitle={labels.menu} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm">
          <SidebarTrigger label={labels.toggle} />
          <span className="ml-auto truncate text-muted-foreground" title={user.email}>
            {user.name || user.email}
          </span>
          {signOut}
        </div>
        <div id={CONTENT_ID} tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
