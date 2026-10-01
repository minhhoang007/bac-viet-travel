import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createBlog, parsePost } from "..";

const post = (fm: Record<string, unknown>, body = "Nội dung bài viết.") =>
  `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n")}\n---\n${body}\n`;

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "blog-"));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

const base = { title: "T", description: "D", date: "2026-10-01" };
const blogOf = (files: Record<string, string>, extra: { includeDrafts?: boolean; postsPerPage?: number } = {}) =>
  createBlog({ dir: fixture(files), locales: ["vi", "en"], postsPerPage: extra.postsPerPage ?? 10, includeDrafts: extra.includeDrafts ?? false });

describe("parsePost", () => {
  it("reads frontmatter, body and reading time", () => {
    const p = parsePost("vi/xin-chao.mdx", post({ ...base, tags: ["ha-long"] }, "từ ".repeat(400)), "vi");
    expect(p).toMatchObject({ slug: "xin-chao", locale: "vi", title: "T", tags: ["ha-long"], draft: false, readingMinutes: 2 });
    expect(p.body.trim().startsWith("từ")).toBe(true);
  });

  it("names the file and every invalid field", () => {
    expect(() => parsePost("vi/a.mdx", post({ title: "", date: "01/10/2026" }), "vi")).toThrow(
      /vi\/a\.mdx: title: .*description: .*date: /,
    );
    expect(() => parsePost("vi/a.mdx", "no frontmatter", "vi")).toThrow(/missing frontmatter/);
    expect(() => parsePost("vi/Bai Viet.mdx", post(base), "vi")).toThrow(/slug/);
    expect(() => parsePost("vi/a.mdx", post({ ...base, tags: ["Hạ Long"] }), "vi")).toThrow(/tags/);
  });
});

describe("createBlog", () => {
  const files = {
    "vi/cu.mdx": post({ ...base, date: "2026-01-01", tags: ["meo"] }),
    "vi/moi.mdx": post({ ...base, date: "2026-09-01", tags: ["meo", "ha-long"], translationKey: "welcome" }),
    "vi/nhap.mdx": post({ ...base, date: "2026-09-30", draft: true }),
    "en/welcome.mdx": post({ ...base, translationKey: "welcome" }),
    "vi/readme.txt": "ignored",
  };

  it("lists newest first, filters by tag, hides drafts", () => {
    const blog = blogOf(files);
    expect(blog.list("vi").map((p) => p.slug)).toEqual(["moi", "cu"]);
    expect(blog.list("vi", { tag: "ha-long" }).map((p) => p.slug)).toEqual(["moi"]);
    expect(blog.get("vi", "nhap")).toBeNull();
    expect(blog.list("vi")[0]).not.toHaveProperty("body");
  });

  it("shows drafts when asked (development)", () => {
    expect(blogOf(files, { includeDrafts: true }).list("vi").map((p) => p.slug)).toEqual(["nhap", "moi", "cu"]);
  });

  it("counts tags and links translations both ways", () => {
    const blog = blogOf(files);
    expect(blog.tags("vi")).toEqual([{ tag: "meo", count: 2 }, { tag: "ha-long", count: 1 }]);
    expect(blog.translations(blog.get("vi", "moi")!)).toEqual({ en: "welcome" });
    expect(blog.translations(blog.get("en", "welcome")!)).toEqual({ vi: "moi" });
    expect(blog.translations(blog.get("vi", "cu")!)).toEqual({});
  });

  it("paginates and clamps the page number", () => {
    const blog = blogOf(files, { postsPerPage: 1 });
    expect(blog.page("vi", 2)).toMatchObject({ page: 2, totalPages: 2, posts: [expect.objectContaining({ slug: "cu" })] });
    expect(blog.page("vi", 99).page).toBe(2);
    expect(blog.page("en", 1).totalPages).toBe(1);
  });

  it("works with no posts or no folder", () => {
    const blog = createBlog({ dir: path.join(tmpdir(), "does-not-exist"), locales: ["vi"], postsPerPage: 10, includeDrafts: false });
    expect(blog.list("vi")).toEqual([]);
    expect(blog.page("vi", 1)).toEqual({ posts: [], page: 1, totalPages: 1 });
  });
});
