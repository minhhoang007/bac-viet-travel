import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/container";

type Side = { title: string; items: string[] };

export interface ProblemSolutionProps {
  id?: string;
  title: string;
  before: Side;
  after: Side;
}

/** Before/after comparison: the pain the visitor has now next to what the product changes. */
export function ProblemSolution({ id, title, before, after }: ProblemSolutionProps) {
  return (
    <section id={id} className="border-t border-border py-16">
      <Container>
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Column side={before} icon={<X aria-hidden="true" className="size-4 text-destructive" />} />
          <Column side={after} icon={<Check aria-hidden="true" className="size-4 text-primary" />} highlighted />
        </div>
      </Container>
    </section>
  );
}

function Column({ side, icon, highlighted }: { side: Side; icon: ReactNode; highlighted?: boolean }) {
  return (
    <div className={highlighted ? "rounded-lg border-2 border-primary p-6" : "rounded-lg border border-border bg-muted/40 p-6"}>
      <h3 className="font-semibold">{side.title}</h3>
      <ul className="mt-4 grid gap-2 text-sm">
        {side.items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
