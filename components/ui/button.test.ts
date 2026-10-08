import { describe, expect, it } from "vitest";
import { isPagePath } from "./button";

describe("isPagePath", () => {
  it("accepts same-site page paths", () => {
    expect(isPagePath("/")).toBe(true);
    expect(isPagePath("/en/tours?type=private")).toBe(true);
  });

  it("leaves anchors, other sites, protocol-relative URLs and API routes to plain links", () => {
    for (const href of [undefined, "", "#contact", "https://example.com", "//example.com", "mailto:a@b.c", "/api/health"]) {
      expect(isPagePath(href)).toBe(false);
    }
  });
});
