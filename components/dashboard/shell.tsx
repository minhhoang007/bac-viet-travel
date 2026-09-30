import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export interface DashboardShellProps {
  brand: { label: string; href: string };
  nav: { label: string; href: string; active?: boolean }[];
  user: { name: string; email: string };
  /** A form (server action) rendering the sign-out button. */
  signOut: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ brand, nav, user, signOut, children }: DashboardShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col sm:flex-row">
      <aside className="border-b border-border p-4 sm:w-56 sm:border-r sm:border-b-0">
        <a href={brand.href} className="font-semibold">
          {brand.label}
        </a>
        <nav className="mt-4 flex gap-2 overflow-x-auto sm:flex-col">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn("rounded px-3 py-2 text-sm whitespace-nowrap hover:bg-muted", item.active && "bg-muted font-medium")}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <div className="flex items-center justify-end gap-3 border-b border-border px-4 py-3 text-sm">
          <span className="truncate text-muted-foreground" title={user.email}>
            {user.name || user.email}
          </span>
          {signOut}
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
