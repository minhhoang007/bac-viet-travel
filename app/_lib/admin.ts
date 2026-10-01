import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getContainer, type Container } from "@/bootstrap/container";
import type { AuthUser } from "@/core/auth";
import type { AdminModule } from "@/modules/admin";
import { requireAppServices } from "./session";

/**
 * Admin pages and actions: the admin module must be on and the user must be an admin.
 * Everyone else (signed out included) gets a 404, so the admin area does not reveal itself.
 */
export async function requireAdmin(): Promise<{ admin: AdminModule; user: AuthUser; container: Container }> {
  const app = await requireAppServices();
  const container = getContainer();
  if (!container.admin) notFound();
  const user = await app.auth.getUser(await headers());
  if (!user || user.role !== "admin") notFound();
  return { admin: container.admin, user, container };
}
