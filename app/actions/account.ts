"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/app/_lib/session";
import { hasRole } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";

const localeSchema = z.enum(["vi", "en"]).catch("vi");

/**
 * Deletes the signed-in account after the user retypes their email. Customers only: a staff session may not have
 * passed its second factor yet (magic link alone), and deleting would also wipe its passkeys, codes and audit trail,
 * or the last admin. Staff are removed by an admin.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const { app, user } = await currentUser();
  const locale = localeSchema.parse(formData.get("locale"));
  if (!user) redirect(localePath(locale, "/login"));
  if (hasRole(user, "editor")) redirect(localePath(locale, "/dashboard/account?error=staff"));

  const confirmation = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  if (confirmation !== user.email.toLowerCase()) redirect(localePath(locale, "/dashboard/account?error=confirm"));

  await app.account.deleteAccount(user.id);
  await app.auth.signOut(await headers()).catch(() => {}); // session rows are already gone; clear the cookie
  redirect(localePath(locale));
}
