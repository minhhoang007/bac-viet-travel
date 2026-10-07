"use client";

import { MenuIcon, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Link = { label: string; href: string };

/** Header menu below the lg breakpoint: a sheet with destinations, pages, hotline and the booking button. */
export function MobileNav({
  labels,
  destinations,
  links,
  locale,
  phone,
  book,
}: {
  labels: { open: string; close: string; title: string; destinations: string; call: string };
  destinations: Link[];
  links: Link[];
  locale: Link & { hrefLang: string };
  phone: Link;
  book: Link;
}) {
  const item = "block rounded-md px-3 py-3 text-base hover:bg-muted";
  return (
    <Sheet>
      <SheetTrigger className="inline-flex size-10 items-center justify-center rounded-full border border-border lg:hidden" aria-label={labels.open}>
        <MenuIcon className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" closeLabel={labels.close} className="w-[85vw] max-w-80 overflow-y-auto">
        <SheetTitle className="px-4 pt-4 font-heading text-xl">{labels.title}</SheetTitle>
        <nav className="grid gap-1 px-2 pb-6" data-testid="mobile-menu">
          <p className="px-3 pt-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">{labels.destinations}</p>
          {destinations.map((l) => (
            <a key={l.href} href={l.href} className={item}>
              {l.label}
            </a>
          ))}
          <hr className="my-2 border-border" />
          {links.map((l) => (
            <a key={l.href} href={l.href} className={item}>
              {l.label}
            </a>
          ))}
          <a href={locale.href} hrefLang={locale.hrefLang} className={item}>
            {locale.label}
          </a>
          <div className="mt-4 grid gap-2 px-2">
            <a href={book.href} className="type-label inline-flex h-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              {book.label}
            </a>
            <a href={phone.href} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border" aria-label={`${labels.call} ${phone.label}`}>
              <Phone className="size-4" aria-hidden="true" />
              {phone.label}
            </a>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
