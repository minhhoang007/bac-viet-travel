/** Blog module: off → no pages, feed or sitemap entries; on → the sample posts parse (content/blog). */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureDefaults } from "@/config/features.defaults";
import { blogConfig } from "@/config/blog";
import { appConfig } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { createBlog } from "@/modules/blog";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/config/features");
  vi.doUnmock("@/config/blog");
});

// Own fixture posts: init:project deletes the starter sample posts, so projects must not depend on them.
function fixtureDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "blog-"));
  const post = (title: string) => `---
title: "${title}"
description: "d"
date: "2026-10-01"
translationKey: "welcome"
---
Hi
`;
  mkdirSync(path.join(dir, "vi"));
  mkdirSync(path.join(dir, "en"));
  writeFileSync(path.join(dir, "vi", "chao-mung-den-voi-blog.mdx"), post("Chào mừng"));
  writeFileSync(path.join(dir, "en", "welcome-to-the-blog.mdx"), post("Welcome to the blog"));
  return dir;
}

const withFeatures = (blog: boolean) => vi.doMock("@/config/features", () => ({ features: { ...featureDefaults, blog } }));

// First imports of the app routes (container, auth, MDX) take seconds on a busy machine.
describe("blog module", { timeout: 30_000 }, () => {
  it("off: getBlog() is undefined, the feed is 404, the sitemap has no blog entries", async () => {
    withFeatures(false);
    const { getBlog } = await import("@/bootstrap/blog");
    expect(getBlog()).toBeUndefined();
    const rss = await import("@/app/[locale]/blog/rss.xml/route");
    expect((await rss.GET(new Request("http://x"), { params: Promise.resolve({ locale: "vi" }) })).status).toBe(404);
    const sitemap = await (await import("@/app/sitemap")).default();
    expect(sitemap.some((e) => e.url.includes("/blog"))).toBe(false);
  });

  it("on: feed and sitemap include the posts", async () => {
    withFeatures(true);
    const dir = fixtureDir();
    vi.doMock("@/config/blog", () => ({ blogConfig: { ...blogConfig, dir } }));
    const rss = await import("@/app/[locale]/blog/rss.xml/route");
    const res = await rss.GET(new Request("http://x"), { params: Promise.resolve({ locale: "en" }) });
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    expect(await res.text()).toContain("<title>Welcome to the blog</title>");
    const sitemap = await (await import("@/app/sitemap")).default();
    // Locale-agnostic: projects may change the default locale (no prefix) in config/app.ts.
    const url = (locale: string, slug: string) => `http://localhost:3000${localePath(locale, `/blog/${slug}`)}`;
    expect(sitemap.find((e) => e.url === url("en", "welcome-to-the-blog"))?.alternates?.languages).toEqual({
      vi: url("vi", "chao-mung-den-voi-blog"),
      en: url("en", "welcome-to-the-blog"),
    });
  });

  it("every post in content/blog has valid frontmatter (fails the test like it fails the build)", () => {
    expect(() => createBlog({ dir: blogConfig.dir, locales: appConfig.locales, postsPerPage: 10, includeDrafts: true })).not.toThrow();
  });
});
