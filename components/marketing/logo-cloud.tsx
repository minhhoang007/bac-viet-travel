import { Container } from "@/components/ui/container";

export interface LogoCloudProps {
  id?: string;
  /** e.g. "Được tin dùng bởi". */
  title: string;
  /** `name` is the image's alt text. */
  items: { name: string; src: string; href?: string }[];
}

/** Customer or partner logos, grayscale until hovered. */
export function LogoCloud({ id, title, items }: LogoCloudProps) {
  return (
    <section id={id} className="border-t border-border py-10">
      <Container>
        <h2 className="text-center text-sm font-medium text-muted-foreground">{title}</h2>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((logo) => {
            const img = (
              // eslint-disable-next-line @next/next/no-img-element -- SVG/PNG logos of any size, no remotePatterns
              <img
                src={logo.src}
                alt={logo.name}
                height={32}
                loading="lazy"
                className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
              />
            );
            return <li key={logo.name}>{logo.href ? <a href={logo.href}>{img}</a> : img}</li>;
          })}
        </ul>
      </Container>
    </section>
  );
}
