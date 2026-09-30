import { describe, expect, it } from "vitest";
import { createMetadata, localizedUrl, type SeoSite } from ".";

const site: SeoSite = {
  siteUrl: "https://example.com",
  siteName: "Example",
  titleTemplate: "%s | Example",
  defaultOgImage: "/og.png",
  locales: ["vi", "en"],
  defaultLocale: "vi",
};

describe("SEO", () => {
  it("default locale has no prefix, others do", () => {
    expect(localizedUrl(site, "vi", "/")).toBe("https://example.com/");
    expect(localizedUrl(site, "en", "/")).toBe("https://example.com/en");
    expect(localizedUrl(site, "en", "/pricing")).toBe("https://example.com/en/pricing");
  });

  it("builds canonical, hreflang, OpenGraph and Twitter", () => {
    const m = createMetadata(site, { title: "Pricing", description: "d", path: "/pricing", locale: "en" });
    expect(m.title).toEqual({ absolute: "Pricing | Example" });
    expect(m.alternates?.canonical).toBe("https://example.com/en/pricing");
    expect(m.alternates?.languages).toEqual({
      vi: "https://example.com/pricing",
      en: "https://example.com/en/pricing",
      "x-default": "https://example.com/pricing",
    });
    expect(m.openGraph).toMatchObject({ url: "https://example.com/en/pricing", locale: "en" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: ["https://example.com/og.png"] });
  });

  it("supports noindex", () => {
    const m = createMetadata(site, { title: "t", description: "d", path: "/", locale: "vi", noIndex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
