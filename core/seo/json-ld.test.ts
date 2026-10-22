import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, serializeJsonLd } from "./json-ld";
import type { SeoSite } from "./metadata";

const site: SeoSite = { siteUrl: "https://example.com", siteName: "Example", titleTemplate: "%s | Example", defaultOgImage: "/og.png", locales: ["vi", "en"], defaultLocale: "vi" };

describe("breadcrumbJsonLd", () => {
  it("starts at the home page and links each step in the page's locale", () => {
    const ld = breadcrumbJsonLd(site, "en", "Example", [{ path: "/blog", name: "Blog" }, { path: "/blog/a", name: "A" }]);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Example", item: "https://example.com/en" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://example.com/en/blog" },
      { "@type": "ListItem", position: 3, name: "A", item: "https://example.com/en/blog/a" },
    ]);
  });
});

describe("serializeJsonLd", () => {
  it("round-trips data", () => {
    const data = { "@context": "https://schema.org", "@type": "Organization", name: "Hạ Long & Co" };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("cannot close the script element or inject markup", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toMatch(/<|>/);
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
