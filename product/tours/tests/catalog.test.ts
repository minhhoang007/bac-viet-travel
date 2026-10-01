import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTourCatalog, getTourCatalog, parseTour } from "../catalog";

const valid = {
  title: "T",
  summary: "S",
  destination: "sapa",
  days: 2,
  nights: 1,
  price: { vnd: 1000000, usd: 40 },
  images: ["/tours/sapa-1.jpg"],
  departure: "Daily",
  groupSize: "12",
  highlights: ["h"],
  itinerary: [{ title: "d1", description: "x" }],
  includes: ["i"],
};
const file = (fm: object, body = "") => `---\n${JSON.stringify(fm)}\n---\n${body}`;

describe("tour catalog", () => {
  it("the real content is valid, translated, and has featured tours for every locale", () => {
    const catalog = getTourCatalog();
    expect(catalog.slugs()).toHaveLength(6);
    for (const locale of ["vi", "en"]) {
      expect(catalog.list(locale)).toHaveLength(6);
      expect(catalog.featured(locale).length).toBeGreaterThan(0);
      expect(new Set(catalog.list(locale).map((t) => t.destination))).toEqual(new Set(["ha-long", "ninh-binh", "sapa"]));
    }
  });

  it("names the file and the field for invalid tours", () => {
    expect(() => parseTour("vi/a.mdx", file({ ...valid, destination: "hue", price: { vnd: -1, usd: 1 } }), "vi")).toThrow(/vi\/a\.mdx: destination: .*price\.vnd/);
    expect(() => parseTour("vi/a.mdx", file({ ...valid, nights: 3 }), "vi")).toThrow(/nights cannot exceed days/);
    expect(() => parseTour("vi/Tour A.mdx", file(valid), "vi")).toThrow(/slug/);
  });

  it("requires every tour in every locale and orders by destination, then order", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tours-"));
    mkdirSync(path.join(dir, "vi"));
    mkdirSync(path.join(dir, "en"));
    writeFileSync(path.join(dir, "vi", "a.mdx"), file({ ...valid, destination: "sapa", order: 2 }));
    writeFileSync(path.join(dir, "vi", "b.mdx"), file({ ...valid, destination: "ha-long" }));
    writeFileSync(path.join(dir, "en", "a.mdx"), file(valid));
    expect(() => createTourCatalog(dir, ["vi", "en"])).toThrow(/missing a translation .*b/);
    writeFileSync(path.join(dir, "en", "b.mdx"), file(valid));
    const catalog = createTourCatalog(dir, ["vi", "en"]);
    expect(catalog.list("vi").map((t) => t.slug)).toEqual(["b", "a"]);
    expect(catalog.related(catalog.get("en", "a")!).map((t) => t.slug)).toEqual(["b"]);
  });
});
