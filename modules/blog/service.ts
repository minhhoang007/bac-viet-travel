import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Blog posts are MDX files written by the project team and committed to the repo (trusted content).
 * Never feed user-submitted text to the MDX renderer: MDX can run code.
 */
const frontmatterSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(300),
  date: z.iso.date(),
  updated: z.iso.date().optional(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/, "tags are lowercase-with-dashes")).default([]),
  /** Path under public/ (e.g. /blog/cover.jpg) or an absolute URL. */
  cover: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  /** Same key on posts in different locales = translations of each other (hreflang, language switch). */
  translationKey: z.string().regex(/^[a-z0-9-]+$/).optional(),
  draft: z.boolean().default(false),
});

export type PostFrontmatter = z.infer<typeof frontmatterSchema>;

export interface PostSummary extends PostFrontmatter {
  locale: string;
  slug: string;
  readingMinutes: number;
}

export interface Post extends PostSummary {
  /** MDX body without the frontmatter. */
  body: string;
}

export interface Blog {
  /** Newest first. Drafts only when `includeDrafts`. */
  list(locale: string, options?: { tag?: string }): PostSummary[];
  page(locale: string, page: number): { posts: PostSummary[]; page: number; totalPages: number };
  get(locale: string, slug: string): Post | null;
  /** Tags with post counts, most used first. */
  tags(locale: string): { tag: string; count: number }[];
  /** Other-locale versions of a post (by translationKey): { en: "slug" }. */
  translations(post: PostSummary): Record<string, string>;
}

export class BlogContentError extends Error {}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Parses one post file; throws BlogContentError naming the file and every invalid field. */
export function parsePost(file: string, source: string, locale: string, wordsPerMinute = 200): Post {
  const slug = path.basename(file).replace(/\.mdx$/, "");
  if (!SLUG.test(slug)) throw new BlogContentError(`${file}: file name must be a lowercase-with-dashes slug`);
  const match = source.match(FRONTMATTER);
  if (!match) throw new BlogContentError(`${file}: missing frontmatter (--- title: … ---)`);
  let raw: unknown;
  try {
    raw = parseYaml(match[1]!);
  } catch (error) {
    throw new BlogContentError(`${file}: invalid frontmatter YAML: ${(error as Error).message}`);
  }
  const parsed = frontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "frontmatter"}: ${i.message}`).join("; ");
    throw new BlogContentError(`${file}: ${issues}`);
  }
  const body = source.slice(match[0].length);
  const words = body.replace(/<[^>]+>|[#>*_`~[\]()-]/g, " ").split(/\s+/).filter(Boolean).length;
  return { ...parsed.data, locale, slug, body, readingMinutes: Math.max(1, Math.round(words / wordsPerMinute)) };
}

export interface BlogOptions {
  dir: string;
  locales: readonly string[];
  postsPerPage: number;
  includeDrafts: boolean;
  wordsPerMinute?: number;
}

/** Reads every post once (at build time for prerendered pages) and serves lookups from memory. */
export function createBlog(options: BlogOptions): Blog {
  const byLocale = new Map<string, Post[]>();
  for (const locale of options.locales) {
    const folder = path.join(options.dir, locale);
    const files = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith(".mdx")) : [];
    const posts = files
      .map((f) => parsePost(path.join(folder, f), readFileSync(path.join(folder, f), "utf8"), locale, options.wordsPerMinute))
      .filter((p) => options.includeDrafts || !p.draft)
      .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
    byLocale.set(locale, posts);
  }

  const summary = ({ body, ...rest }: Post): PostSummary => (void body, rest);
  const posts = (locale: string) => byLocale.get(locale) ?? [];

  return {
    list(locale, { tag } = {}) {
      return posts(locale).filter((p) => !tag || p.tags.includes(tag)).map(summary);
    },
    page(locale, page) {
      const all = posts(locale);
      const totalPages = Math.max(1, Math.ceil(all.length / options.postsPerPage));
      const current = Math.min(Math.max(1, page), totalPages);
      const start = (current - 1) * options.postsPerPage;
      return { posts: all.slice(start, start + options.postsPerPage).map(summary), page: current, totalPages };
    },
    get(locale, slug) {
      return posts(locale).find((p) => p.slug === slug) ?? null;
    },
    tags(locale) {
      const counts = new Map<string, number>();
      for (const p of posts(locale)) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    },
    translations(post) {
      if (!post.translationKey) return {};
      const result: Record<string, string> = {};
      for (const [locale, list] of byLocale) {
        if (locale === post.locale) continue;
        const match = list.find((p) => p.translationKey === post.translationKey);
        if (match) result[locale] = match.slug;
      }
      return result;
    },
  };
}
