import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export interface CtaProps {
  id?: string;
  title: string;
  subtitle: string;
  button: { label: string; href: string };
  /** Replaces the button, e.g. with a contact form. */
  children?: ReactNode;
}

export function Cta({ id, title, subtitle, button, children }: CtaProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container className="text-center">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-3 text-muted-foreground">{subtitle}</p>
        {children ? (
          <div className="mt-8">{children}</div>
        ) : (
          <ButtonLink href={button.href} className="mt-6">
            {button.label}
          </ButtonLink>
        )}
      </Container>
    </section>
  );
}
