import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
        <Accordion type="single" collapsible className="mt-8">
          {items.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
              {/* forceMount keeps answers in the server HTML (search engines), hidden until opened */}
              <AccordionContent forceMount className="text-muted-foreground" data-faq-answer="">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
