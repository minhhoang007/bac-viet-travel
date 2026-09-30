import { Container } from "@/components/ui/container";

export interface LegalPageProps {
  title: string;
  updatedLabel: string;
  updated: string;
  notice: string;
  sections: { heading: string; body: string }[];
}

export function LegalPage({ title, updatedLabel, updated, notice, sections }: LegalPageProps) {
  return (
    <Container className="max-w-3xl py-16">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {updatedLabel}: {updated}
      </p>
      <p className="mt-6 rounded-md border border-border bg-muted p-3 text-sm">{notice}</p>
      {sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-xl font-semibold">{s.heading}</h2>
          <p className="mt-2 text-muted-foreground">{s.body}</p>
        </section>
      ))}
    </Container>
  );
}
