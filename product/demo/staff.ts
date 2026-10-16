import type { StaffRole } from "../staff/permissions";

/** Demo staff accounts (product/manifest.ts `demoAccounts`): editors with a staff role, never admins. No DB imports. */
export const DEMO_STAFF: { email: string; name: string; role: StaffRole }[] = [
  { email: "demo-quanly@example.com", name: "Quản lý (demo)", role: "manager" },
  { email: "demo-sale@example.com", name: "Sale (demo)", role: "sale" },
];
