import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("drops Vietnamese marks, đ becomes d, and joins words with dashes", () => {
    expect(slugify("Ninh Bình 2 ngày 1 đêm: Bái Đính – Tràng An")).toBe("ninh-binh-2-ngay-1-dem-bai-dinh-trang-an");
    expect(slugify("Đà Lạt")).toBe("da-lat");
  });

  it("matches the slug pattern the forms accept, even from symbols only or a very long title", () => {
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    expect(slugify("  Hạ Long!!! (2026)  ")).toMatch(pattern);
    expect(slugify("???")).toBe("");
    const long = slugify("tour ".repeat(40));
    expect(long.length).toBeLessThanOrEqual(110);
    expect(long).toMatch(pattern);
  });
});
