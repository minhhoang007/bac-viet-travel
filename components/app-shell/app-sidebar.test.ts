import { describe, expect, it } from "vitest";
import { activeHref, groupNav } from "./app-sidebar";

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

describe("groupNav", () => {
  it("keeps sections in first-appearance order and items in their order; untitled items form one section", () => {
    const item = (label: string, group?: string) => ({ label, href: `/${label}`, group });
    expect(groupNav([item("a"), item("b", "Nội dung"), item("c"), item("d", "Hệ thống"), item("e", "Nội dung")])).toEqual([
      { title: undefined, items: [item("a"), item("c")] },
      { title: "Nội dung", items: [item("b", "Nội dung"), item("e", "Nội dung")] },
      { title: "Hệ thống", items: [item("d", "Hệ thống")] },
    ]);
  });
});
