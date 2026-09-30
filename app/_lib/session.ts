import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getContainer, type AppServices } from "@/bootstrap/container";
import type { AuthUser } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";

/**
 * App-profile services, or 404 in profile "site".
 * connection() makes callers render at request time, so builds never need runtime secrets.
 */
export async function requireAppServices(): Promise<AppServices> {
  await connection();
  const { app } = getContainer();
  if (!app) notFound();
  return app;
}

/** Signed-in user for pages; redirects to the login page otherwise. */
export async function requirePageUser(locale: string): Promise<{ app: AppServices; user: AuthUser }> {
  const app = await requireAppServices();
  const user = await app.auth.getUser(await headers());
  if (!user) redirect(localePath(locale, authConfig.signInPath));
  return { app, user };
}

/** Signed-in user for server actions and route handlers; null when signed out. */
export async function currentUser(): Promise<{ app: AppServices; user: AuthUser | null }> {
  const app = await requireAppServices();
  return { app, user: await app.auth.getUser(await headers()) };
}
