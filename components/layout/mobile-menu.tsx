"use client";

import { MenuIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface MobileMenuProps {
  title: string;
  openLabel: string;
  closeLabel: string;
  links: { label: string; href: string }[];
}

/** Header navigation below the sm breakpoint: a slide-in sheet. */
export function MobileMenu({ title, openLabel, closeLabel, links }: MobileMenuProps) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-md border border-border sm:hidden" aria-label={openLabel}>
        <MenuIcon className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" closeLabel={closeLabel} className="w-72">
        <SheetTitle className="px-4 pt-4">{title}</SheetTitle>
        <nav className="grid gap-1 px-2 pb-6" data-testid="mobile-menu">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-3 text-base hover:bg-muted">
              {l.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
