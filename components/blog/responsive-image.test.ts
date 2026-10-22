import { describe, expect, it } from "vitest";
import { responsiveImage } from "./mdx";

describe("responsiveImage", () => {
  it("Unsplash: three widths, and the shape from `ar`", () => {
    const r = responsiveImage("https://images.unsplash.com/photo-1?ixid=x&w=1600&q=80&auto=format&fit=crop&ar=3:2");
    expect(r.aspectRatio).toBe("3 / 2");
    expect(r.srcSet?.split(", ")).toHaveLength(3);
    expect(r.srcSet).toContain("w=640&q=80");
    expect(r.srcSet).toMatch(/w=1600.* 1600w$/);
  });

  it("Cloudinary: a width transformation in front of the stored image; no shape", () => {
    const r = responsiveImage("https://res.cloudinary.com/demo/image/upload/v1712/tours/ha-long.jpg");
    expect(r.srcSet).toContain("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1712/tours/ha-long.jpg 640w");
    expect(r.aspectRatio).toBeUndefined();
  });

  it("other images are left as they are", () => {
    expect(responsiveImage("/blog/ha-long.jpg")).toEqual({});
    expect(responsiveImage("https://images.unsplash.com/photo-1?w=1600").aspectRatio).toBeUndefined();
  });
});
