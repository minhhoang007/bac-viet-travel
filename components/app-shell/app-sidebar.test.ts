import { describe, expect, it } from "vitest";
import { activeHref } from "./app-sidebar";

describe("activeHref", () => {
  const hrefs = ["/vi/dashboard", "/vi/dashboard/account", "/vi/dashboard/product/notes"];

  it("picks the deepest matching item", () => {
    expect(activeHref("/vi/dashboard", hrefs)).toBe("/vi/dashboard");
    expect(activeHref("/vi/dashboard/account", hrefs)).toBe("/vi/dashboard/account");
    expect(activeHref("/vi/dashboard/product/notes/123", hrefs)).toBe("/vi/dashboard/product/notes");
  });

  it("does not match on a shared prefix that is not a parent path", () => {
    expect(activeHref("/vi/dashboard-old", hrefs)).toBeUndefined();
  });
});
