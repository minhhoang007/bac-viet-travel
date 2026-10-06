import { describe, expect, it } from "vitest";
import { isAppShellPath } from "./site-chrome";

describe("isAppShellPath", () => {
  it("matches admin and dashboard with or without a locale prefix", () => {
    for (const p of ["/admin", "/admin/tours/1", "/dashboard", "/en/admin", "/en/dashboard/settings"]) expect(isAppShellPath(p)).toBe(true);
  });
  it("leaves public pages alone", () => {
    for (const p of ["/", "/en", "/administration", "/blog/admin", "/en/pricing", "/dashboards"]) expect(isAppShellPath(p)).toBe(false);
  });
});
