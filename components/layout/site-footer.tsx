import { Container } from "@/components/ui/container";

export function SiteFooter({ name, rights, year }: { name: string; rights: string; year: number }) {
  return (
    <footer className="border-t border-border py-8 text-sm text-muted-foreground">
      <Container>
        © {year} {name}. {rights}
      </Container>
    </footer>
  );
}
