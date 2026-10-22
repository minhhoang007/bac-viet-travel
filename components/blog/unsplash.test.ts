import { describe, expect, it } from "vitest";
import { isUnsplashPhoto, unsplashUtm } from "./unsplash";

describe("unsplash", () => {
  it("names the app in the referral, as Unsplash's guidelines ask", () => {
    expect(unsplashUtm("Bắc Việt Travel")).toBe("utm_source=bac_viet_travel&utm_medium=referral");
    expect(unsplashUtm("Minh Starter!")).toBe("utm_source=minh_starter&utm_medium=referral");
  });

  it("knows its hotlinked photos", () => {
    expect(isUnsplashPhoto("https://images.unsplash.com/photo-1?w=1600")).toBe(true);
    expect(isUnsplashPhoto("https://images.unsplash.com.evil.example/a.jpg")).toBe(false);
    expect(isUnsplashPhoto("/blog/cover.jpg")).toBe(false);
  });
});
