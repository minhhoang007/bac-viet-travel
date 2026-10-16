// Starter-owned. Projects override in config/blog.ts (ADR-0004).

export const blogDefaults = {
  /**
   * "mdx": posts are files in the repo (prerendered). "content": posts are written in the admin (/admin/posts) and
   * stored by the content module (needs features.content); pages render at request time from a cached copy.
   */
  source: "mdx" as "mdx" | "content",
  /** Folder with one subfolder per locale: content/blog/<locale>/<slug>.mdx (source "mdx", and blog:import). */
  dir: "content/blog",
  postsPerPage: 10,
  /** Used when a post has no `author` in its frontmatter. */
  defaultAuthor: "",
  /** Words per minute for the reading-time estimate. */
  wordsPerMinute: 200,
  /** Display names of tags per locale (tags themselves stay lowercase-with-dashes in URLs); missing = the tag. */
  tagLabels: {} as Record<string, Partial<Record<string, string>>>,
  /**
   * Who writes, by the name used as `author`: a box under their posts and the author in structured data (search
   * engines weigh who stands behind travel advice). `organization`: a team or the company, not a person. Text per
   * locale; `url`: a page about them (an about page, a profile).
   */
  authors: {} as Record<string, { organization?: boolean; role?: Partial<Record<string, string>>; bio?: Partial<Record<string, string>>; url?: string }>,
};

export type BlogConfig = typeof blogDefaults;
