import { describe, expect, it } from "vitest";
import { createMetadata, localizedUrl, type SeoSite } from ".";
import { ogSignature, verifiedOgTitle } from "./og";

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

  it("translated pages: hreflang only for existing translations, article OpenGraph", () => {
    const m = createMetadata(site, {
      title: "Tips",
      description: "d",
      path: "/blog/ha-long-tips",
      locale: "en",
      alternatePaths: { vi: "/blog/meo-ha-long" },
      article: { publishedTime: "2026-10-01", tags: ["ha-long"] },
    });
    expect(m.alternates?.languages).toEqual({
      vi: "https://example.com/blog/meo-ha-long",
      en: "https://example.com/en/blog/ha-long-tips",
      "x-default": "https://example.com/blog/meo-ha-long",
    });
    expect(m.openGraph).toMatchObject({ type: "article", publishedTime: "2026-10-01", tags: ["ha-long"] });

    const alone = createMetadata(site, { title: "T", description: "d", path: "/blog/only-en", locale: "en", alternatePaths: {} });
    expect(alone.alternates?.languages).toEqual({ en: "https://example.com/en/blog/only-en" });
  });

  it("pages without an image get a generated one with their title when dynamicOgImage is on", () => {
    const m = createMetadata({ ...site, dynamicOgImage: true, ogSecret: "k" }, { title: "Tour Hạ Long", description: "d", path: "/", locale: "vi" });
    expect(m.openGraph?.images).toEqual([{ url: `https://example.com/api/og?title=Tour%20H%E1%BA%A1%20Long&s=${ogSignature("k", "Tour Hạ Long")}` }]);
    const own = createMetadata({ ...site, dynamicOgImage: true }, { title: "T", description: "d", path: "/", locale: "vi", image: "/a.jpg" });
    expect(own.openGraph?.images).toEqual([{ url: "https://example.com/a.jpg" }]);
    // No key (a build without secrets): the generic brand image, never an unsigned title.
    expect(createMetadata({ ...site, dynamicOgImage: true }, { title: "T", description: "d", path: "/", locale: "vi" }).openGraph?.images).toEqual([{ url: "https://example.com/api/og" }]);
  });
});

describe("share image titles (og)", () => {
  it("draws only titles signed with the site key", () => {
    const s = ogSignature("key", "Tour Hạ Long");
    expect(verifiedOgTitle("Tour Hạ Long", s, "key")).toBe("Tour Hạ Long");
    expect(verifiedOgTitle("Bắc Việt lừa đảo", s, "key")).toBeNull();
    expect(verifiedOgTitle("Tour Hạ Long", s, "other-key")).toBeNull();
    expect(verifiedOgTitle("Tour Hạ Long", null, "key")).toBeNull();
    expect(verifiedOgTitle("Tour Hạ Long", s, undefined)).toBeNull();
  });
});
