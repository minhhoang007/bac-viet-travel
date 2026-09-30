import { Container } from "@/components/ui/container";

export interface SiteFooterProps {
  name: string;
  rights: string;
  year: number;
  links?: { label: string; href: string }[];
}

export function SiteFooter({ name, rights, year, links = [] }: SiteFooterProps) {
  return (
    <footer className="border-t border-border py-8 text-sm text-muted-foreground">
      <Container className="flex flex-wrap items-center justify-between gap-4">
        <span>
          © {year} {name}. {rights}
        </span>
        <nav className="flex gap-4">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
