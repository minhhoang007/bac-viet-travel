import { IntentLink } from "./intent-link";
import Image from "next/image";
import { ArrowRight, ChevronDown, Phone } from "lucide-react";
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
import { DESTINATION_PHOTO } from "../tours/photos";
import { HoverMenu } from "./hover-menu";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

/** Menu entry: brass rule on the header's bottom edge on hover and for the current section. */
const navItem =
  "relative transition-colors hover:text-primary aria-[current=page]:text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:scale-x-100 aria-[current=page]:after:scale-x-100";
const iconButton = "inline-flex size-10 items-center justify-center rounded-md border border-border transition-colors hover:border-primary hover:text-primary";

/** Site header (ProductHeader): top bar with licence and contacts, main bar with menu, hotline and "Book". */
export function SiteHeader({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  const h = c.header;
  const href = (path: string) => localePath(locale, path);
  const other = appConfig.locales.find((l) => l !== locale) ?? appConfig.defaultLocale;
  const switchLabel = getMarketingContent(locale).nav.switchLocale;
  const destinations = DESTINATIONS.map((d) => ({ label: c.destinations[d].name, href: href(`/tours/${d}`), photo: DESTINATION_PHOTO[d] }));
  // Links from config/navigation.ts (starter contract); the blog entry only while the blog is on.
  const links = siteNavigation.filter((l) => features.blog || l.href !== "/blog").map((l) => ({ label: l.label[locale], href: href(l.href) }));
  const m = getMarketingContent(locale).nav;

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="hidden border-b border-border bg-muted text-xs text-muted-foreground md:block">
        <Container className="flex h-8 items-center justify-between gap-4">
          <span className="truncate">
            {contactConfig.licenseType[locale]} {contactConfig.licenseNumber} · {h.pickup}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <a href={`mailto:${contactConfig.email}`} className="hover:text-foreground">
              {contactConfig.email}
            </a>
            <a href={localePath(other)} hrefLang={other} className="font-medium hover:text-foreground">
              {switchLabel}
            </a>
          </span>
        </Container>
      </div>
      <div className="relative border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
          <IntentLink href={href("/")} aria-label={h.home} className="shrink-0">
            <Logo size="sm" />
          </IntentLink>

          <nav aria-label={h.nav} className="type-label hidden h-full items-stretch gap-7 whitespace-nowrap lg:flex xl:gap-9">
            {/* Opens on hover and on keyboard focus (focus-within), links stay real links; closes after a choice. */}
            <HoverMenu className="group flex">
              <IntentLink href={href("/tours")} className={`${navItem} inline-flex items-center gap-1.5 group-hover:text-primary group-hover:after:scale-x-100 group-focus-within:after:scale-x-100`}>
                {h.destinations}
                <ChevronDown className="size-3.5 transition duration-300 group-hover:rotate-180 group-focus-within:rotate-180" aria-hidden="true" />
              </IntentLink>
              {/* Full-width panel under the header bar: intro with all tours, then one photo card per destination. */}
              <div className="invisible absolute inset-x-0 top-full border-y border-border bg-background normal-case tracking-normal opacity-0 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)] transition duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 group-data-[closed]:hidden">
                <Container className="grid grid-cols-[minmax(11rem,0.8fr)_1fr_1fr_1fr] gap-6 py-8 xl:gap-8">
                  <div className="flex flex-col gap-3 border-r border-border pr-6">
                    <span className="type-eyebrow text-primary">{c.home.eyebrows.destinations}</span>
                    <span className="font-heading text-2xl leading-tight text-balance whitespace-normal">{c.home.destinationsTitle}</span>
                    <IntentLink href={href("/tours")} className="type-label mt-auto inline-flex items-center gap-2 text-primary hover:underline hover:underline-offset-4">
                      {h.allTours}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </IntentLink>
                  </div>
                  {DESTINATIONS.map((d) => (
                    <IntentLink key={d} href={href(`/tours/${d}`)} className="group/card grid content-start gap-3">
                      <span className="relative block aspect-[16/10] overflow-hidden bg-muted">
                        <Image src={DESTINATION_PHOTO[d]} alt="" fill sizes="22vw" className="object-cover saturate-[.88] transition duration-700 group-hover/card:scale-[1.04]" />
                      </span>
                      <span className="font-heading text-xl group-hover/card:text-primary">{c.destinations[d].name}</span>
                      <span className="type-small line-clamp-3 whitespace-normal text-muted-foreground">{c.destinations[d].tagline}</span>
                    </IntentLink>
                  ))}
                </Container>
              </div>
            </HoverMenu>
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} className={`${navItem} flex items-center`}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href={telUrl()} className="hidden whitespace-nowrap text-right leading-tight 2xl:grid">
              <span className="text-xs text-muted-foreground">
                {h.advice} {contactConfig.hoursShort}
              </span>
              <span className="font-semibold">{contactConfig.hotline}</span>
            </a>
            <a href={telUrl()} aria-label={h.call} className={`${iconButton} 2xl:hidden`}>
              <Phone className="size-4" aria-hidden="true" />
            </a>
            <ButtonLink href={href("/tours")} className="type-label hidden px-6 sm:inline-flex">
              {h.book}
            </ButtonLink>
            <MobileNav
              labels={{ open: m.menu, close: m.close, title: "Bắc Việt Travel", destinations: h.destinations, call: h.call, hours: contactConfig.hoursShort }}
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
