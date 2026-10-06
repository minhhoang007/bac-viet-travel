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
};

export type BlogConfig = typeof blogDefaults;
