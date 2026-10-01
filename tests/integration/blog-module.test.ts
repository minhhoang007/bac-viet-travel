/** Blog module: off → no pages, feed or sitemap entries; on → the sample posts parse (content/blog). */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureDefaults } from "@/config/features.defaults";
import { blogConfig } from "@/config/blog";
import { appConfig } from "@/config/app";
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

describe("blog module", () => {
  it("off: getBlog() is undefined, the feed is 404, the sitemap has no blog entries", async () => {
    withFeatures(false);
    const { getBlog } = await import("@/bootstrap/blog");
    expect(getBlog()).toBeUndefined();
    const rss = await import("@/app/[locale]/blog/rss.xml/route");
    expect((await rss.GET(new Request("http://x"), { params: Promise.resolve({ locale: "vi" }) })).status).toBe(404);
    expect(rss.generateStaticParams()).toEqual([]);
    const sitemap = (await import("@/app/sitemap")).default();
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
    const sitemap = (await import("@/app/sitemap")).default();
    expect(sitemap.find((e) => e.url.endsWith("/en/blog/welcome-to-the-blog"))?.alternates?.languages).toEqual({
      vi: "http://localhost:3000/blog/chao-mung-den-voi-blog",
      en: "http://localhost:3000/en/blog/welcome-to-the-blog",
    });
  });

  it("every post in content/blog has valid frontmatter (fails the test like it fails the build)", () => {
    expect(() => createBlog({ dir: blogConfig.dir, locales: appConfig.locales, postsPerPage: 10, includeDrafts: true })).not.toThrow();
  });
});
