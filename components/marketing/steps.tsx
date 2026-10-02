import { Container } from "@/components/ui/container";

export interface StepsProps {
  id?: string;
  title: string;
  items: { title: string; description: string }[];
}

/** "How it works": numbered steps. */
export function Steps({ id, title, items }: StepsProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container>
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.title} className="grid content-start gap-2">
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {i + 1}
              </span>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
