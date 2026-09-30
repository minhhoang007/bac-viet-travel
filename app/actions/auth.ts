"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppServices } from "@/app/_lib/session";
import { localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";

export type MagicLinkState = { status: "sent" } | { status: "invalid_email" } | { status: "error" } | null;

const emailSchema = z.email().max(200);
const localeSchema = z.enum(["vi", "en"]).catch("vi");

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const app = await requireAppServices();
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "invalid_email" };
  const locale = localeSchema.parse(formData.get("locale"));
  try {
    await app.auth.signInMagicLink(email.data, localePath(locale, authConfig.afterSignInPath), await headers());
    return { status: "sent" };
  } catch {
    return { status: "error" };
  }
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const app = await requireAppServices();
  const locale = localeSchema.parse(formData.get("locale"));
  const url = await app.auth.signInGoogle(localePath(locale, authConfig.afterSignInPath), await headers());
  redirect(url);
}

export async function signOut(formData: FormData): Promise<void> {
  const app = await requireAppServices();
  await app.auth.signOut(await headers());
  redirect(localePath(localeSchema.parse(formData.get("locale"))));
}
