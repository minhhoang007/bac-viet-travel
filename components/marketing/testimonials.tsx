import { Container } from "@/components/ui/container";

export interface Testimonial {
  quote: string;
  name: string;
  /** e.g. "Founder, Bắc Việt Travel". */
  role?: string;
  /** Path under public/ or an image URL allowed by the CSP. */
  avatar?: string;
}

export interface TestimonialsProps {
  id?: string;
  title: string;
  /** Real customer quotes only, used with their permission. */
  items: Testimonial[];
}

export function Testimonials({ id, title, items }: TestimonialsProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container>
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.name + t.quote} className="flex flex-col gap-4 rounded-lg border border-border p-6">
              <blockquote className="text-sm">“{t.quote}”</blockquote>
              <figcaption className="mt-auto flex items-center gap-3 text-sm">
                {t.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatars from anywhere, no remotePatterns
                  <img src={t.avatar} alt="" width={40} height={40} loading="lazy" className="size-10 rounded-full object-cover" />
                )}
                <span>
                  <span className="block font-medium">{t.name}</span>
                  {t.role && <span className="block text-muted-foreground">{t.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
