import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/components/ui/cn";

export interface HeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Optional full-bleed background photo (path under public/). Text turns white over a dark overlay. */
  image?: { src: string; alt: string };
}

export function Hero({ eyebrow, title, subtitle, primary, secondary, image }: HeroProps) {
  return (
    <section className={cn("relative py-20 sm:py-28", image && "flex min-h-[70vh] items-center text-white")}>
      {image && (
        <>
          <Image src={image.src} alt={image.alt} fill priority sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-black/45" />
        </>
      )}
      <Container className="text-center">
        <p className={cn("text-sm font-medium", image ? "text-white/90" : "text-primary")}>{eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className={cn("mx-auto mt-5 max-w-2xl text-lg", image ? "text-white/90" : "text-muted-foreground")}>{subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
          {secondary && (
            <ButtonLink href={secondary.href} variant="outline" className={cn(image && "border-white/70 bg-transparent text-white hover:bg-white/10")}>
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      </Container>
    </section>
  );
}
