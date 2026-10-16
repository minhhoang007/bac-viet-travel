import { describe, expect, it } from "vitest";
import { getTourCatalog } from "../catalog";
import { fromMdxTours, staticImageSrc, toTour, tourDocumentSchema, tourDraftSchema, tourProblems, type TourDocument } from "../document";

const catalog = getTourCatalog();
const docOf = (slug: string) => fromMdxTours({ vi: catalog.get("vi", slug)!, en: catalog.get("en", slug)! });

describe("tour document (content module)", () => {
  it("every real MDX tour converts and reads back unchanged in both locales", () => {
    for (const slug of catalog.slugs()) {
      const doc = docOf(slug);
      for (const locale of ["vi", "en"] as const) {
        const original = catalog.get(locale, slug)!;
        expect(toTour(doc, slug, locale)).toEqual({ ...original, body: original.body.trim() });
      }
    }
  });

  it("survives a JSON round trip (stored as jsonb)", () => {
    const doc = docOf(catalog.slugs()[0]!);
    expect(tourDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("lists what is missing or wrong, by field", () => {
    const doc = docOf(catalog.slugs()[0]!);
    const broken = structuredClone(doc) as unknown as { shared: Record<string, unknown>; en: Record<string, unknown> };
    broken.shared.nights = 9;
    broken.shared.images = [];
    broken.en.title = "  ";
    expect(tourProblems(broken)).toEqual(expect.arrayContaining(["shared.nights", "shared.images", "en.title"]));
    expect(tourProblems(doc)).toEqual([]);
  });

  it("images: public paths or library ids only; library images resolve through the given function", () => {
    const doc: TourDocument = structuredClone(docOf(catalog.slugs()[0]!));
    expect(tourProblems({ ...doc, shared: { ...doc.shared, images: [{ src: "https://evil.example/x.jpg" }] } })).toEqual([expect.stringMatching(/^shared\.images\.0/)]);
    const id = "0199c7a1-1234-7abc-8def-0123456789ab";
    doc.shared.images = [{ mediaId: id }, { src: "/tours/sapa-1.jpg" }];
    expect(toTour(doc, "x", "vi", (i) => ("mediaId" in i ? `https://img.test/${i.mediaId}` : staticImageSrc(i))).images).toEqual([`https://img.test/${id}`, "/tours/sapa-1.jpg"]);
    // An image that no longer resolves (deleted) is skipped, not rendered broken.
    expect(toTour(doc, "x", "vi", (i) => ("src" in i ? i.src : null)).images).toEqual(["/tours/sapa-1.jpg"]);
  });

  it("Unsplash photos: hotlinked from its CDN only, each with its photographer's credit kept in step with the images", () => {
    const doc: TourDocument = structuredClone(docOf(catalog.slugs()[0]!));
    const credit = { name: "Duc Nguyen", url: "https://unsplash.com/@duc?utm_source=bac_viet_travel&utm_medium=referral" };
    const photo = { unsplash: { src: "https://images.unsplash.com/photo-1?w=1600", credit } };
    doc.shared.images = [{ src: "/tours/sapa-1.jpg" }, photo];
    expect(tourProblems(doc)).toEqual([]);
    const tour = toTour(doc, "x", "vi");
    expect(tour.images).toEqual(["/tours/sapa-1.jpg", "https://images.unsplash.com/photo-1?w=1600"]);
    expect(tour.imageCredits).toEqual([null, credit]);
    // Own photos only: no credits list at all.
    doc.shared.images = [{ src: "/tours/sapa-1.jpg" }];
    expect(toTour(doc, "x", "vi").imageCredits).toBeUndefined();
    for (const src of ["https://evil.example/photo.jpg", "http://images.unsplash.com/photo-1"])
      expect(tourProblems({ ...doc, shared: { ...doc.shared, images: [{ unsplash: { src, credit } }] } })).toEqual([expect.stringMatching(/^shared\.images\.0/)]);
  });

  it("drafts may be incomplete but keep the three sections", () => {
    expect(tourDraftSchema.parse({ vi: { title: "Nháp" } })).toEqual({ shared: {}, vi: { title: "Nháp" }, en: {} });
    expect(tourDraftSchema.safeParse({ vi: "x" }).success).toBe(false);
  });
});
