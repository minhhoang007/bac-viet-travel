import { describe, expect, it } from "vitest";
import { can, isStaffRole, PERMISSIONS } from "../permissions";

describe("staff permissions (H2)", () => {
  it("admins may do everything, with or without a staff role", () => {
    for (const p of PERMISSIONS) expect(can({ role: "admin" }, null, p)).toBe(true);
  });

  it("managers: all booking work, departures, discounts and reports", () => {
    for (const p of PERMISSIONS) expect(can({ role: "editor" }, "manager", p)).toBe(true);
  });

  it("sales: view and enter bookings only; no confirm, cancel, money, departures, discounts or reports", () => {
    const allowed = PERMISSIONS.filter((p) => can({ role: "editor" }, "sale", p));
    expect(allowed).toEqual(["bookings.view", "bookings.edit"]);
  });

  it("no staff role, or not even an editor: nothing", () => {
    for (const p of PERMISSIONS) {
      expect(can({ role: "editor" }, null, p)).toBe(false);
      expect(can({ role: "user" }, "manager", p)).toBe(false);
    }
  });

  it("recognises only the known roles", () => {
    expect(isStaffRole("sale")).toBe(true);
    expect(isStaffRole("manager")).toBe(true);
    expect(isStaffRole("admin")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });
});
