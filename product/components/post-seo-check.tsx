"use client";
// Post editor sidebar: what the guide still needs for Google and readers, updated as the writer types.
import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { seoChecks, type SeoCheck, type SeoCheckKey } from "../blog/seo-check";

/** Messages per check; `{n}` is the measured value (functions cannot cross to a client component). */
export type SeoCheckText = { heading: string; hint: string } & Record<SeoCheckKey, string>;

/** Reads the editor form's fields by name (title, description, cover, body); the form is the page's, not this one. */
function read(form: HTMLFormElement): SeoCheck[] {
  const value = (name: string) => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "";
  };
  return seoChecks({ title: value("title"), description: value("description"), cover: value("cover"), body: value("body") });
}

export function PostSeoCheck({ formId, t }: { formId: string; t: SeoCheckText }) {
  const [checks, setChecks] = useState<SeoCheck[] | null>(null);
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const update = () => setChecks(read(form));
    // First reading after paint (the fields are filled by then), then on every change.
    const first = requestAnimationFrame(update);
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(first);
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, [formId]);
  if (!checks) return null;
  const todo = checks.filter((c) => !c.ok).length;

  return (
    <section className="mt-6 rounded-lg border border-border p-4" aria-labelledby="seo-check-title" data-testid="post-seo-check">
      <h2 id="seo-check-title" className="flex items-baseline justify-between gap-2 font-semibold">
        {t.heading}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {checks.length - todo}/{checks.length}
        </span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <ul className="mt-3 grid gap-2 text-sm">
        {checks.map((c) => (
          <li key={c.key} className="flex gap-2" data-seo={c.key} data-ok={c.ok}>
            {c.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />}
            <span className={c.ok ? "text-muted-foreground" : undefined}>{t[c.key].replace("{n}", String(c.value))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
