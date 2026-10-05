import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/components/ui/cn";

export interface PricingPlan {
  name: string;
  /** Already formatted, e.g. "199.000 ₫" or "Liên hệ". */
  price: string;
  /** e.g. "/ tháng". */
  period?: string;
  description?: string;
  features?: string[];
  cta: { label: string; href: string };
  /** Visually emphasized (most popular plan). */
  highlighted?: boolean;
  /** Small label shown on a highlighted plan, e.g. "Phổ biến". */
  badge?: string;
}

export interface PricingProps {
  id?: string;
  /** Heading level: h2 inside a landing page, h1 on a page of its own. */
  as?: "h1" | "h2";
  title: string;
  subtitle?: string;
  plans: PricingPlan[];
}

/** Pricing cards. Content-driven, so it works without the billing module; the billing /pricing page uses it too. */
export function Pricing({ id, as: Heading = "h2", title, subtitle, plans }: PricingProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container>
        <Heading className="text-center text-3xl font-bold">{title}</Heading>
        {subtitle && <p className="mt-3 text-center text-muted-foreground">{subtitle}</p>}
        <div className={cn("mx-auto mt-10 grid gap-6", plans.length >= 3 ? "max-w-5xl md:grid-cols-3" : "max-w-3xl sm:grid-cols-2")}>
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={cn("flex flex-col rounded-lg p-6", plan.highlighted ? "border-2 border-primary" : "border border-border")}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.highlighted && plan.badge && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">{plan.badge}</span>
                )}
              </div>
              <p className="mt-3 text-3xl font-bold">
                {plan.price}
                {plan.period && <span className="text-sm font-normal text-muted-foreground"> {plan.period}</span>}
              </p>
              {plan.description && <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>}
              {plan.features && plan.features.length > 0 && (
                <ul className="mt-6 grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-6">
                <ButtonLink href={plan.cta.href} variant={plan.highlighted ? "primary" : "outline"} className="w-full">
                  {plan.cta.label}
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
