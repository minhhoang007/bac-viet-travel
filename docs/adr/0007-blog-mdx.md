# ADR-0007: Blog with MDX files in the repo

- Status: **Accepted** (2026-10-01)

## Context
Site projects (e.g. a tour operator) need a blog for SEO. REQUIREMENTS §2 excludes a complex CMS from V1.
The blog must work in profile "site" (no database, no secrets) and support vi/en.

## Decision
1. **Posts are `.mdx` files** in `content/blog/<locale>/<slug>.mdx`; the file name is the URL slug.
   Frontmatter (YAML) is validated with zod: `title`, `description`, `date` required; `updated`, `tags`, `cover`,
   `author`, `translationKey`, `draft` optional. An invalid post **fails the build** with the file and field names.
2. **Rendering:** `@mdx-js/mdx` `evaluate` in a server component, with `remark-gfm` (tables, task lists) and a small
   component set (`Callout`, `Figure` with `next/image`, safe external links). Every blog page is **prerendered**
   (`generateStaticParams`, `dynamicParams = false`): no file system access at request time, unknown slugs are 404.
3. **Translations:** posts sharing a `translationKey` are linked (hreflang, "read in …" link, sitemap alternates).
   A post without a translation gets no hreflang for the missing locale (no links to non-existent pages).
4. **SEO:** per-post metadata (canonical, OpenGraph `article`), JSON-LD `BlogPosting`, posts in `sitemap.xml`,
   an RSS 2.0 feed per locale (`/blog/rss.xml`, `/en/blog/rss.xml`).
5. **Drafts:** `draft: true` posts are visible in development and excluded from production builds.
6. The blog is read through `bootstrap/blog.ts` (`getBlog()`), not the container, so blog pages never require
   runtime secrets.

## Security
MDX can execute JavaScript at build time. Posts are trusted content committed by the project team (same trust as
source code). **Never render user-submitted text with the MDX renderer**; comments or user posts need a sanitized
Markdown renderer instead.

## Consequences
- Writing a post needs a git commit and a deploy (fine for a team that ships through Git; a CMS can be added later
  behind the same `Blog` interface).
- Out of scope: comments, full-text search, scheduled publishing, author pages.
