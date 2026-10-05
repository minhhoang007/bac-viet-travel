import { describe, expect, it } from "vitest";
import { hasRole } from "./service";

describe("roles", () => {
  it("are hierarchical: admin ⊇ editor ⊇ user", () => {
    expect(hasRole({ role: "admin" }, "editor")).toBe(true);
    expect(hasRole({ role: "editor" }, "editor")).toBe(true);
    expect(hasRole({ role: "editor" }, "admin")).toBe(false);
    expect(hasRole({ role: "user" }, "editor")).toBe(false);
    expect(hasRole({ role: "user" }, "user")).toBe(true);
  });
});
