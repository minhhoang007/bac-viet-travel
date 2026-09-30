import { Container } from "@/components/ui/container";

export interface SiteHeaderProps {
  logoText: string;
  homeHref: string;
  links: { label: string; href: string }[];
  localeSwitch: { label: string; href: string; hrefLang: string };
}

export function SiteHeader({ logoText, homeHref, links, localeSwitch }: SiteHeaderProps) {
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
        </nav>
      </Container>
    </header>
  );
}
