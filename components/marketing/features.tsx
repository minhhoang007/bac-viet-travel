import { Container } from "@/components/ui/container";

export interface FeaturesProps {
  id?: string;
  title: string;
  items: { title: string; description: string }[];
}

export function Features({ id, title, items }: FeaturesProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container>
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-lg border border-border p-6">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
