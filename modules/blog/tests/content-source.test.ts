import { describe, expect, it } from "vitest";
import { blogFromPosts, contentPostProblems, postFromContent } from "..";

const data = (extra: Record<string, unknown> = {}) => ({
  locale: "vi",
  title: "Kinh nghiệm đi Hạ Long",
  description: "Mùa đẹp, giá vé, lịch trình gợi ý.",
  date: "2026-10-01",
  tags: ["ha-long"],
  body: "## Mùa nào đẹp\n\nTháng 10 đến tháng 4.",
  ...extra,
});

describe("posts stored in the content module", () => {
  it("a complete post has no problems; missing fields are listed by name", () => {
    expect(contentPostProblems(data())).toEqual([]);
    expect(contentPostProblems({ locale: "vi", title: "", tags: ["Bad Tag"] })).toEqual(expect.arrayContaining(["title", "description", "date", "tags.0", "body"]));
  });

  it("a cover is a path on the site or an image on the allowed CDNs (the CSP blocks other hosts)", () => {
    for (const cover of ["/blog/cover.jpg", "https://res.cloudinary.com/demo/image/upload/v1/site/a.jpg", "https://images.unsplash.com/photo-123?w=1600&auto=format"])
      expect(contentPostProblems(data({ cover }))).toEqual([]);
    for (const cover of [
      "https://example.com/a.jpg",
      "//evil.example/a.jpg",
      "javascript:alert(1)",
      "http://images.unsplash.com/photo-1",
      "https://images.unsplash.com.evil.example/a.jpg",
    ])
      expect(contentPostProblems(data({ cover }))).toEqual(["cover"]);
  });

  it("keeps the cover's credit (name and https link) for licensed photos", () => {
    const credit = { name: "Duc Nguyen", url: "https://unsplash.com/@duc?utm_source=bac_viet_travel&utm_medium=referral" };
    expect(postFromContent("ha-long", data({ cover: "https://images.unsplash.com/photo-1", coverCredit: credit }))?.coverCredit).toEqual(credit);
    expect(contentPostProblems(data({ coverCredit: { name: "X", url: "javascript:alert(1)" } }))).toEqual(["coverCredit.url"]);
  });

  it("keeps quick facts by key (the project names and orders them); short text, plain keys", () => {
    const facts = { bestTime: "Tháng 4–6", budget: "2–3 triệu" };
    expect(postFromContent("ha-long", data({ facts }))?.facts).toEqual(facts);
    expect(contentPostProblems(data({ facts: { bestTime: "x".repeat(121) } }))).toEqual(["facts.bestTime"]);
    expect(contentPostProblems(data({ facts: { "best-time": "x" } }))).toEqual(["facts.best-time"]);
  });

  it("becomes a Markdown post (never MDX), with reading time", () => {
    const post = postFromContent("kinh-nghiem-di-ha-long", data());
    expect(post).toMatchObject({ slug: "kinh-nghiem-di-ha-long", locale: "vi", format: "markdown", draft: false, readingMinutes: 1 });
    expect(postFromContent("kinh-nghiem", { ...data(), title: "" })).toBeNull();
    expect(postFromContent("Bad Slug", data())).toBeNull();
  });

  it("builds the same lookups as the file blog: per locale, newest first, tags, translations, pages", () => {
    const posts = [
      postFromContent("cu", data({ date: "2026-09-01", tags: ["ha-long", "kinh-nghiem"], translationKey: "tips" }))!,
      postFromContent("moi", data({ date: "2026-10-02" }))!,
      postFromContent("tips", data({ locale: "en", title: "Tips", translationKey: "tips" }))!,
    ];
    const blog = blogFromPosts(posts, { locales: ["vi", "en"], postsPerPage: 1 });
    expect(blog.list("vi").map((p) => p.slug)).toEqual(["moi", "cu"]);
    expect(blog.list("en").map((p) => p.slug)).toEqual(["tips"]);
    expect(blog.tags("vi")).toEqual([
      { tag: "ha-long", count: 2 },
      { tag: "kinh-nghiem", count: 1 },
    ]);
    expect(blog.translations(blog.get("vi", "cu")!)).toEqual({ en: "tips" });
    expect(blog.page("vi", 2)).toMatchObject({ page: 2, totalPages: 2, posts: [{ slug: "cu" }] });
    expect(blog.get("vi", "tips")).toBeNull();
  });
});
