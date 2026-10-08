"use client";

import Image from "next/image";
import { ArrowRight, MenuIcon, Phone, XIcon } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "../brand/logo";
import { NavLink } from "./nav-link";

type Link = { label: string; href: string };

const iconButton = "inline-flex size-10 items-center justify-center rounded-md border border-border transition-colors hover:border-primary hover:text-primary";

/** Header menu below the lg breakpoint: logo bar, destination photos, pages in the heading serif, booking and hotline pinned to the bottom. */
export function MobileNav({
  labels,
  destinations,
  links,
  locale,
  phone,
  book,
}: {
  labels: { open: string; close: string; title: string; destinations: string; call: string; hours: string };
  destinations: (Link & { photo: string })[];
  links: Link[];
  locale: Link & { hrefLang: string };
  phone: Link;
  book: Link;
}) {
  return (
    <Sheet>
      <SheetTrigger className={`${iconButton} lg:hidden`} aria-label={labels.open}>
        <MenuIcon className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" closeLabel={labels.close} showCloseButton={false} className="w-[88vw] max-w-sm gap-0">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <Logo size="sm" />
          <SheetTitle className="sr-only">{labels.title}</SheetTitle>
          <SheetClose className={iconButton}>
            <XIcon className="size-5" aria-hidden="true" />
            <span className="sr-only">{labels.close}</span>
          </SheetClose>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-6" data-testid="mobile-menu">
          <p className="type-eyebrow text-muted-foreground">{labels.destinations}</p>
          <ul className="mt-3 grid gap-2">
            {destinations.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="group flex items-center gap-4 py-1">
                  <span className="relative block h-12 w-16 shrink-0 overflow-hidden bg-muted">
                    <Image src={l.photo} alt="" fill sizes="64px" className="object-cover saturate-[.88]" />
                  </span>
                  <span className="font-heading text-xl group-hover:text-primary">{l.label}</span>
                  <ArrowRight className="ml-auto size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>

          <ul className="mt-6 border-t border-border">
            {links.map((l) => (
              <li key={l.href} className="border-b border-border">
                <NavLink href={l.href} className="block py-3.5 font-heading text-2xl hover:text-primary aria-[current=page]:text-primary">
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <a href={locale.href} hrefLang={locale.hrefLang} className="type-label mt-5 inline-block text-muted-foreground hover:text-primary">
            {locale.label}
          </a>
        </nav>

        <div className="grid shrink-0 gap-2 border-t border-border bg-muted px-5 py-4">
          <a href={book.href} className="type-label inline-flex h-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {book.label}
          </a>
          <a href={phone.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-background" aria-label={`${labels.call} ${phone.label}`}>
            <Phone className="size-4" aria-hidden="true" />
            <span className="font-medium">{phone.label}</span>
            <span className="text-xs text-muted-foreground">· {labels.hours}</span>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
