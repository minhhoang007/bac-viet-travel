import { notFound } from "next/navigation";
import { can, type Permission, type StaffRole } from "@/product/staff/permissions";
import { requireStaff } from "./admin";

/**
 * Booking admin guard (H2): admins, or editors whose staff role grants `permission`. Everyone else gets a 404 like
 * the rest of the admin area. `allowed` answers for other permissions on the same page (which buttons to show).
 */
export async function requirePermission(permission: Permission) {
  const ctx = await requireStaff("editor");
  const staffRole: StaffRole | null = ctx.user.role === "admin" ? null : await ctx.container.app!.product.staff.roleOf(ctx.user.id);
  if (!can(ctx.user, staffRole, permission)) notFound();
  return { ...ctx, staffRole, allowed: (p: Permission) => can(ctx.user, staffRole, p) };
}

/** Tour pages and actions: admins and editors, except sales (the same rule as the Tours menu entry in the manifest). */
export async function requireTourEditor() {
  const ctx = await requireStaff("editor");
  if (ctx.user.role !== "admin" && (await ctx.container.app!.product.staff.roleOf(ctx.user.id)) === "sale") notFound();
  return ctx;
}
