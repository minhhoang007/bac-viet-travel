import { describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import { getTourCatalog } from "../catalog";
import { fromMdxTours } from "../document";
import { createTourSource } from "../source";

const mdx = getTourCatalog();
const published = mdx.slugs().map((slug, i) => ({ id: String(i), slug, data: fromMdxTours({ vi: mdx.get("vi", slug)!, en: mdx.get("en", slug)! }), publishedAt: new Date() }));

function capture() {
  const lines: Record<string, unknown>[] = [];
  return { lines, logger: createLogger({ write: (line: string) => void lines.push(JSON.parse(line)) }) };
}

describe("tour source", () => {
  it("published tours build the same catalog as the MDX files", async () => {
    const { logger } = capture();
    const catalog = await createTourSource({ listPublished: async () => published, fallback: () => mdx, logger }).catalog();
    expect(catalog.slugs()).toEqual(mdx.slugs());
    for (const locale of ["vi", "en"]) expect(catalog.list(locale).map((t) => t.slug)).toEqual(mdx.list(locale).map((t) => t.slug));
    expect(catalog.get("en", "ha-long-cruise-2d1n")?.title).toBe(mdx.get("en", "ha-long-cruise-2d1n")?.title);
  });

  it("skips (and logs) a published tour that no longer matches the schema, without the guest text", async () => {
    const { lines, logger } = capture();
    const broken = { ...published[0]!, data: { ...published[0]!.data, vi: { title: "" } } };
    const catalog = await createTourSource({ listPublished: async () => [broken, ...published.slice(1)], fallback: () => mdx, logger }).catalog();
    expect(catalog.get("vi", broken.slug)).toBeNull();
    expect(catalog.slugs()).toHaveLength(published.length - 1);
    expect(lines).toEqual([expect.objectContaining({ msg: "tours.invalid_published", slug: broken.slug, fields: expect.arrayContaining(["vi.title"]) })]);
  });

  it("reads the MDX files without a content source, and goes through the cache with one", async () => {
    const { logger } = capture();
    expect((await createTourSource({ fallback: () => mdx, logger }).catalog()).slugs()).toEqual(mdx.slugs());
    let reads = 0;
    let movedReads = 0;
    const store = new Map<string, unknown>();
    const source = createTourSource({
      listPublished: async () => (reads++, published),
      listMoved: async () => (movedReads++, [{ from: "ha-long-old", to: "ha-long-cruise-2d1n" }]),
      cache: <T,>(key: string, load: () => Promise<T>) => async () => (store.has(key) ? (store.get(key) as T) : (store.set(key, await load()), store.get(key) as T)),
      fallback: () => mdx,
      logger,
    });
    await source.catalog();
    await source.catalog();
    expect(reads).toBe(1);
    // Old URLs: one cached read for every lookup, unknown slugs included.
    expect(await source.moved("ha-long-old")).toBe("ha-long-cruise-2d1n");
    expect(await source.moved("random-bot-path")).toBeNull();
    expect(await source.moved("another")).toBeNull();
    expect(movedReads).toBe(1);
    expect(await createTourSource({ fallback: () => mdx, logger }).moved("ha-long-old")).toBeNull();
  });
});
