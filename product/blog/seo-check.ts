// What a guide needs to do well on Google and with readers, checked while the writer types (post editor sidebar).
// Advice only: nothing here blocks saving or submitting. Pure, so it is tested without a browser.

export type SeoCheckKey = "title" | "description" | "cover" | "sections" | "length" | "alt" | "tour";
export interface SeoCheck {
  key: SeoCheckKey;
  ok: boolean;
  /** Measured value for the message (characters, words, sections, images without a description). */
  value: number;
}

const words = (text: string) => text.replace(/[#*_`>[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;

export function seoChecks(post: { title: string; description: string; cover: string; body: string }): SeoCheck[] {
  const title = post.title.trim().length;
  const description = post.description.trim().length;
  const sections = (post.body.match(/^##\s+\S/gm) ?? []).length;
  const length = words(post.body);
  const noAlt = (post.body.match(/!\[\s*\]\(/g) ?? []).length;
  return [
    // Google shows about 60 characters of a title and 155 of a description.
    { key: "title", ok: title >= 20 && title <= 65, value: title },
    { key: "description", ok: description >= 70 && description <= 160, value: description },
    { key: "cover", ok: post.cover.trim() !== "", value: 0 },
    { key: "sections", ok: sections >= 3, value: sections },
    { key: "length", ok: length >= 600, value: length },
    { key: "alt", ok: noAlt === 0, value: noAlt },
    // A guide should lead somewhere: a tour card or a link to a tour page.
    { key: "tour", ok: /<Tour\s+slug=|\]\(\/(?:en\/)?tours\//.test(post.body), value: 0 },
  ];
}
