// Starter-owned. Projects override in config/blog.ts (ADR-0004).

export const blogDefaults = {
  /** Folder with one subfolder per locale: content/blog/<locale>/<slug>.mdx */
  dir: "content/blog",
  postsPerPage: 10,
  /** Used when a post has no `author` in its frontmatter. */
  defaultAuthor: "",
  /** Words per minute for the reading-time estimate. */
  wordsPerMinute: 200,
};

export type BlogConfig = typeof blogDefaults;
