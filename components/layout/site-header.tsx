import { Container } from "@/components/ui/container";
import { MobileMenu } from "./mobile-menu";

export interface SiteHeaderProps {
  logoText: string;
  homeHref: string;
  links: { label: string; href: string }[];
  localeSwitch: { label: string; href: string; hrefLang: string };
  /** Labels of the mobile menu (sheet). */
  menu: { open: string; close: string };
}

export function SiteHeader({ logoText, homeHref, links, localeSwitch, menu }: SiteHeaderProps) {
  return (
    <header className="border-b border-border">
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href={homeHref} className="font-semibold">
          {logoText}
        </a>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hidden text-muted-foreground hover:text-foreground sm:inline">
              {l.label}
            </a>
          ))}
          <a href={localeSwitch.href} hrefLang={localeSwitch.hrefLang} className="rounded border border-border px-2 py-1">
            {localeSwitch.label}
          </a>
          {links.length > 0 && <MobileMenu title={logoText} openLabel={menu.open} closeLabel={menu.close} links={links} />}
        </nav>
      </Container>
    </header>
  );
}
