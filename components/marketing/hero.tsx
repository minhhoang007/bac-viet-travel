import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export interface HeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export function Hero({ eyebrow, title, subtitle, primary, secondary }: HeroProps) {
  return (
    <section className="py-20 sm:py-28">
      <Container className="text-center">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
          {secondary && (
            <ButtonLink href={secondary.href} variant="outline">
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      </Container>
    </section>
  );
}
