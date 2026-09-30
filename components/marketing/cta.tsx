import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export interface CtaProps {
  id?: string;
  title: string;
  subtitle: string;
  button: { label: string; href: string };
}

export function Cta({ id, title, subtitle, button }: CtaProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container className="text-center">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-3 text-muted-foreground">{subtitle}</p>
        <ButtonLink href={button.href} className="mt-6">
          {button.label}
        </ButtonLink>
      </Container>
    </section>
  );
}
