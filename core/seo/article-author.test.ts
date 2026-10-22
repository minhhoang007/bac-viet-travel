import { describe, expect, it } from "vitest";
import { articleJsonLd } from "./json-ld";

const base = { title: "T", description: "D", url: "https://x.vn/blog/t", datePublished: "2026-10-01", publisher: "Bắc Việt Travel", locale: "vi" };

describe("articleJsonLd author", () => {
  it("a person by default; a company as an Organization, with its page", () => {
    expect(articleJsonLd({ ...base, author: "Lan" }).author).toEqual({ "@type": "Person", name: "Lan" });
    expect(articleJsonLd({ ...base, author: "Bắc Việt Travel", authorIsOrganization: true, authorUrl: "https://x.vn/about" }).author).toEqual({
      "@type": "Organization",
      name: "Bắc Việt Travel",
      url: "https://x.vn/about",
    });
  });
});
