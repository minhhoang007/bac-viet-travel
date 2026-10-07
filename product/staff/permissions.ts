/**
 * Staff roles for booking work (H2, owner's simple version 2026-10-07). Pure: no database.
 * Starter roles stay as they are (user < editor < admin): admins may do everything; an editor gets booking access
 * only through a staff role stored in product (staff_roles). Pages and actions check the same permission.
 */
export const STAFF_ROLES = ["manager", "sale"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  /** Booking list and detail, passenger lists (print, CSV). */
  "bookings.view",
  /** Staff-entered bookings, guest contact, internal notes. */
  "bookings.edit",
  "bookings.confirm",
  "bookings.cancel",
  /** Bank transfers, balance paid, refunds. */
  "bookings.money",
  "departures",
  "discounts",
  "reports",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const GRANTS = {
  manager: PERMISSIONS,
  sale: ["bookings.view", "bookings.edit"],
} as const satisfies Record<StaffRole, readonly Permission[]>;

export const isStaffRole = (value: unknown): value is StaffRole => (STAFF_ROLES as readonly unknown[]).includes(value);

/** Admins: everything. Editors: what their staff role grants. Everyone else: nothing. */
export function can(user: { role: string }, staffRole: StaffRole | null, permission: Permission): boolean {
  if (user.role === "admin") return true;
  if (user.role !== "editor" || !staffRole) return false;
  return (GRANTS[staffRole] as readonly Permission[]).includes(permission);
}
