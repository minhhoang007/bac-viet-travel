import { ChevronDown, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { contactConfig, telUrl } from "@/config/contact";
import { features } from "@/config/features";
import { siteNavigation } from "@/config/navigation";
import { getMarketingContent } from "@/content";
import { Logo } from "../brand/logo";
import { getProductContent } from "../content";
import { DESTINATIONS } from "../tours/catalog";
import { MobileNav } from "./mobile-nav";

/** Site header (ProductHeader): top bar with licence and contacts, main bar with menu, hotline and "Book". */
export function SiteHeader({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  const h = c.header;
  const href = (path: string) => localePath(locale, path);
  const other = appConfig.locales.find((l) => l !== locale) ?? appConfig.defaultLocale;
  const switchLabel = getMarketingContent(locale).nav.switchLocale;
  const destinations = DESTINATIONS.map((d) => ({ label: c.destinations[d].name, href: href(`/tours#${d}`) }));
  // Links from config/navigation.ts (starter contract); the blog entry only while the blog is on.
  const links = siteNavigation.filter((l) => features.blog || l.href !== "/blog").map((l) => ({ label: l.label[locale], href: href(l.href) }));
  const m = getMarketingContent(locale).nav;

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="hidden bg-foreground text-xs text-background/85 md:block">
        <Container className="flex h-8 items-center justify-between gap-4">
          <span className="truncate">
            {contactConfig.licenseType[locale]} {contactConfig.licenseNumber} · {h.pickup}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <a href={`mailto:${contactConfig.email}`} className="hover:text-background">
              {contactConfig.email}
            </a>
            <a href={localePath(other)} hrefLang={other} className="font-medium hover:text-background">
              {switchLabel}
            </a>
          </span>
        </Container>
      </div>
      <div className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
          <a href={href("/")} aria-label={h.home} className="shrink-0">
            <Logo size="sm" />
          </a>

          <nav aria-label={h.nav} className="hidden items-center gap-7 text-[15px] lg:flex">
            {/* Opens on hover and on keyboard focus (focus-within), links stay real links. */}
            <div className="group relative">
              <a href={href("/tours")} className="inline-flex items-center gap-1 py-2 hover:text-primary">
                {h.destinations}
                <ChevronDown className="size-4 transition group-hover:rotate-180 group-focus-within:rotate-180" aria-hidden="true" />
              </a>
              <ul className="invisible absolute left-0 top-full w-56 translate-y-1 rounded-lg border border-border bg-background p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {destinations.map((d) => (
                  <li key={d.href}>
                    <a href={d.href} className="block rounded-md px-3 py-2 hover:bg-muted">
                      {d.label}
                    </a>
                  </li>
                ))}
                <li className="mt-1 border-t border-border pt-1">
                  <a href={href("/tours")} className="block rounded-md px-3 py-2 text-sm text-primary hover:bg-muted">
                    {h.allTours} →
                  </a>
                </li>
              </ul>
            </div>
            {links.map((l) => (
              <a key={l.href} href={l.href} className="py-2 hover:text-primary">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <a href={telUrl()} className="hidden text-right leading-tight xl:grid">
              <span className="text-xs text-muted-foreground">
                {h.advice} {contactConfig.hoursShort}
              </span>
              <span className="font-semibold">{contactConfig.hotline}</span>
            </a>
            <a href={telUrl()} aria-label={h.call} className="inline-flex size-10 items-center justify-center rounded-full border border-border xl:hidden">
              <Phone className="size-4" aria-hidden="true" />
            </a>
            <ButtonLink href={href("/tours")} className="hidden rounded-full px-5 sm:inline-flex">
              {h.book}
            </ButtonLink>
            <MobileNav
              labels={{ open: m.menu, close: m.close, title: "Bắc Việt Travel", destinations: h.destinations, call: h.call }}
              destinations={destinations}
              links={links}
              locale={{ label: switchLabel, href: localePath(other), hrefLang: other }}
              phone={{ label: contactConfig.hotline, href: telUrl() }}
              book={{ label: h.book, href: href("/tours") }}
            />
          </div>
        </Container>
      </div>
    </header>
  );
}
