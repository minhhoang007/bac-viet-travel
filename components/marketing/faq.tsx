import { Container } from "@/components/ui/container";

export interface FaqProps {
  id?: string;
  title: string;
  items: { question: string; answer: string }[];
}

export function Faq({ id, title, items }: FaqProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container className="max-w-3xl">
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <div className="mt-8 divide-y divide-border">
          {items.map((item) => (
            <details key={item.question} className="py-4">
              <summary className="cursor-pointer font-medium">{item.question}</summary>
              <p className="mt-2 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
