import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getContainer, type Container } from "@/bootstrap/container";
import { authConfig } from "@/config/auth";
import { hasRole, type AuthUser, type Role } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
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
  const current = await app.auth.getSession(await headers());
  if (!current || !hasRole(current.user, role)) notFound();
  // Staff need a second factor (config/auth.ts `staff`): set one up first, or pass it for this session.
  const gate = await app.auth.staffGate(current);
  if (gate === "enroll") redirect(localePath(await getLocale(), `${authConfig.securityPath}?setup=1`));
  if (gate === "verify") redirect(localePath(await getLocale(), authConfig.verifyPath));
  return { admin: container.admin, user: current.user, container };
}

/**
 * Step-up before a sensitive action (money, roles, security settings): the session must have passed a second factor
 * within staff.freshMinutes, otherwise the user verifies again and comes back to `back` (a locale-less path) to redo
 * the action. Call after requireStaff/requireAdmin.
 */
export async function requireFreshSecondFactor(back: string): Promise<void> {
  const app = await requireAppServices();
  const current = await app.auth.getSession(await headers());
  if (!current) notFound();
  if (!app.auth.staffPolicy.requireSecondFactor || app.auth.isFresh(current)) return;
  const next = back.startsWith("/") && !back.startsWith("//") ? back : "/admin";
  redirect(localePath(await getLocale(), `${authConfig.verifyPath}?fresh=1&next=${encodeURIComponent(next)}`));
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
