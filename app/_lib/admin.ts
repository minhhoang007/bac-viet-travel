import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getContainer, type Container } from "@/bootstrap/container";
import { hasRole, type AuthUser, type Role } from "@/core/auth";
import type { AdminModule } from "@/modules/admin";
import * as manifest from "@/product/manifest";
import type { ProductNavItem } from "@/product/manifest";
import { requireAppServices } from "./session";

type StaffContext = { admin: AdminModule; user: AuthUser; container: Container };

/**
 * Admin-area guard: the admin module must be on and the user must hold `role` (hierarchical: "editor" admits
 * admins too). Everyone else (signed out included) gets a 404, so the admin area does not reveal itself.
 */
export async function requireStaff(role: Exclude<Role, "user"> = "editor"): Promise<StaffContext> {
  const app = await requireAppServices();
  const container = getContainer();
  if (!container.admin) notFound();
  const user = await app.auth.getUser(await headers());
  if (!user || !hasRole(user, role)) notFound();
  return { admin: container.admin, user, container };
}

/** Admin pages and actions: admins only (users, money, jobs, audit). Content pages use requireStaff("editor"). */
export function requireAdmin(): Promise<StaffContext> {
  return requireStaff("admin");
}

// Projects created before rc.11 have no productAdminNav export.
const productAdminNav = (manifest as { productAdminNav?: ProductNavItem[] }).productAdminNav ?? [];

type NavRule = { roles?: readonly Role[]; allow?: (user: { id: string; role: Role }) => boolean | Promise<boolean> };

/**
 * Product admin menu entries this user may open. An entry is admin-only unless it lists `roles: ["editor"]`
 * (its pages must then call requireStaff("editor"), and admin-only actions requireAdmin()). An entry may also
 * narrow that with `allow(user)` (e.g. a product staff permission); its pages must check the same rule.
 */
export async function productAdminNavFor(user: { id: string; role: Role }): Promise<ProductNavItem[]> {
  if (hasRole(user, "admin")) return productAdminNav;
  const rules = productAdminNav.map((item) => item as NavRule);
  const visible = await Promise.all(rules.map(async (r) => Boolean(r.roles?.includes(user.role) && (r.allow ? await r.allow(user) : true))));
  return productAdminNav.filter((_, i) => visible[i]);
}
