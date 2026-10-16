"use client";

// The post body: the same Markdown textarea, with a toolbar so editors never have to remember the syntax, and an
// image button (library, upload or Unsplash) that inserts the photo with its caption and credit as plain Markdown.
import { useRef, type ReactNode } from "react";
import { Bold, Heading2, ImagePlus, Link2, List, MessageSquareWarning } from "lucide-react";
import { UNSPLASH_UTM } from "../media/unsplash";
import { ImageDialog, type ImagePickerText, type LibraryItem, type PickerImage } from "./image-picker";

export interface MarkdownEditorText {
  /** Name of the toolbar for screen readers. */
  toolbar: string;
  bold: string;
  heading: string;
  list: string;
  link: string;
  note: string;
  image: string;
  /** First option of the tour list (inserts `<Tour slug="…" />`). */
  tour: string;
  /** Placeholders inserted when nothing is selected. */
  sample: { bold: string; heading: string; item: string; link: string; note: string };
  photoBy: string;
}

/** Markdown for a picked image: the image, then an italic caption line crediting a licensed photo's author. */
export function imageMarkdown(image: PickerImage, photoBy: string): string {
  const alt = (image.alt ?? "").replace(/[[\]]/g, "").trim();
  const credit = image.credit ? `\n*${photoBy} [${image.credit.name.replace(/[[\]]/g, "")}](${image.credit.url}) / [Unsplash](https://unsplash.com/?${UNSPLASH_UTM})*` : "";
  return `\n\n![${alt}](${image.src})${credit}\n\n`;
}

export function MarkdownEditor(props: {
  name: string;
  id: string;
  defaultValue: string;
  describedBy?: string;
  t: MarkdownEditorText;
  picker: { t: ImagePickerText; library?: LibraryItem[]; uploader?: ReactNode; unsplash: boolean };
  /** Published tours, for a card inside the post (`<Tour slug="…" />`). */
  tours?: { slug: string; title: string }[];
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const { t } = props;

  // Wraps the selection (or a sample word) and keeps the inserted text selected for typing over.
  const edit = (make: (selected: string) => { text: string; select?: [number, number] }) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const { text, select } = make(value.slice(a, b));
    el.focus();
    el.setRangeText(text, a, b, "end");
    if (select) el.setSelectionRange(a + select[0], a + select[1]);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const wrap = (before: string, after: string, sample: string) =>
    edit((s) => {
      const inner = s || sample;
      return { text: `${before}${inner}${after}`, select: [before.length, before.length + inner.length] };
    });
  const line = (prefix: string, sample: string) =>
    edit((s) => {
      const inner = s || sample;
      const text = `\n${inner.split("\n").map((l) => `${prefix}${l}`).join("\n")}\n`;
      return { text, select: [1 + prefix.length, text.length - 1] };
    });

  const button = "inline-flex size-9 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className="overflow-hidden rounded-md border border-border focus-within:ring-2 focus-within:ring-primary">
      <div role="toolbar" aria-label={t.toolbar} className="flex flex-wrap gap-1 border-b border-border bg-muted p-1" data-testid="markdown-toolbar">
        <button type="button" className={button} title={t.bold} aria-label={t.bold} onClick={() => wrap("**", "**", t.sample.bold)}>
          <Bold className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className={button} title={t.heading} aria-label={t.heading} onClick={() => line("## ", t.sample.heading)}>
          <Heading2 className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className={button} title={t.list} aria-label={t.list} onClick={() => line("- ", t.sample.item)}>
          <List className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className={button} title={t.link} aria-label={t.link} onClick={() => wrap("[", "](https://)", t.sample.link)}>
          <Link2 className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className={button} title={t.note} aria-label={t.note} onClick={() => wrap("\n<Callout>", "</Callout>\n", t.sample.note)}>
          <MessageSquareWarning className="size-4" aria-hidden="true" />
        </button>
        <ImageDialog {...props.picker} onPick={(image) => edit(() => ({ text: imageMarkdown(image, t.photoBy) }))}>
          <button type="button" className={`${button} w-auto gap-1 px-2 text-sm`} title={t.image}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {t.image}
          </button>
        </ImageDialog>
        {props.tours && props.tours.length > 0 && (
          <select
            aria-label={t.tour}
            value=""
            onChange={(e) => {
              const slug = e.target.value;
              if (slug) edit(() => ({ text: `\n\n<Tour slug="${slug}" />\n\n` }));
            }}
            className="h-9 max-w-48 rounded-md border border-border bg-background px-2 text-sm"
            data-testid="insert-tour"
          >
            <option value="">{t.tour}</option>
            {props.tours.map((tour) => (
              <option key={tour.slug} value={tour.slug}>
                {tour.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        ref={area}
        id={props.id}
        name={props.name}
        rows={20}
        aria-describedby={props.describedBy}
        defaultValue={props.defaultValue}
        className="block w-full bg-background p-3 font-mono text-sm outline-none"
      />
    </div>
  );
}
