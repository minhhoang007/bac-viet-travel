import { describe, expect, it } from "vitest";
import { missingRatios, unsplashSize, withRatios } from "./unsplash-ratio";

const old = "https://images.unsplash.com/photo-1?ixid=x&w=1600&q=80&auto=format&fit=crop";
const done = "https://images.unsplash.com/photo-2?w=1600&ar=3:2";
const md = `Mở bài.\n\n![Vịnh](${old})\n*Ảnh: A / Unsplash*\n\n![](${done})\n\n![x](/blog/local.jpg)\n\n![lại](${old})`;

describe("Unsplash ratios for older posts", () => {
  it("lists Unsplash images without a shape, once each", () => {
    expect(missingRatios(md)).toEqual([old]);
  });

  it("adds ar=W:H (reduced) where the size is known, leaves the rest", () => {
    const out = withRatios(md, new Map([[old, { width: 6000, height: 4000 }]]));
    expect(out.match(/ar=3:2/g)).toHaveLength(3); // both copies of the old one, and the one already done
    expect(out).toContain("![Vịnh](https://images.unsplash.com/photo-1?ixid=x&w=1600&q=80&auto=format&fit=crop&ar=3:2)");
    expect(out).toContain("![x](/blog/local.jpg)");
    expect(withRatios(md, new Map())).toBe(md);
  });

  it("reads the size from the CDN metadata; null when it cannot", async () => {
    const ok = (async () => Response.json({ PixelWidth: 4000, PixelHeight: 6000 })) as unknown as typeof fetch;
    expect(await unsplashSize(old, ok)).toEqual({ width: 4000, height: 6000 });
    const down = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await unsplashSize(old, down)).toBeNull();
  });
});
