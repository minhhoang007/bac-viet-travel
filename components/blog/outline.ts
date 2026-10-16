// Headings of a Markdown post (## and ###), read from the source: ids for the rendered headings (in the same order),
// the table of contents, and the questions of a FAQ section (FAQPage structured data). Pure: no React, no I/O.

export interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

/** Markdown inline syntax out: **bold**, `code`, [text](url), images. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Chi phí & thời gian đi" → "chi-phi-thoi-gian-di" (Vietnamese marks and đ folded). Only a–z, 0–9 and "-": ids the
 * post page sets itself use "_" (post_related…), so a heading never takes one of them.
 */
export function headingSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "muc"
  );
}

/** ## and ### lines outside code fences, in order, with unique ids (a repeated title gets -2, -3…). */
export function outline(source: string): Heading[] {
  const seen = new Map<string, number>();
  const headings: Heading[] = [];
  let fenced = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = !fenced && line.match(/^(##|###)\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = plainText(m[2]!);
    const base = headingSlug(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    headings.push({ level: m[1]!.length as 2 | 3, text, id: n === 1 ? base : `${base}-${n}` });
  }
  return headings;
}

const FAQ_TITLE = /^(câu hỏi thường gặp|hỏi đáp|faq|frequently asked questions)\b/i;

/**
 * Questions of the post's FAQ: a ## section titled "Câu hỏi thường gặp" (or "FAQ"), one ### per question, the text
 * under it as the answer. Empty when the post has none.
 */
export function faq(source: string): { question: string; answer: string }[] {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+/.test(l) && FAQ_TITLE.test(plainText(l.replace(/^##\s+/, ""))));
  if (start < 0) return [];
  const items: { question: string; answer: string[] }[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    const q = line.match(/^###\s+(.+)$/);
    if (q) items.push({ question: plainText(q[1]!), answer: [] });
    else items.at(-1)?.answer.push(line);
  }
  return items.map((i) => ({ question: i.question, answer: plainText(i.answer.join(" ")) })).filter((i) => i.answer);
}
