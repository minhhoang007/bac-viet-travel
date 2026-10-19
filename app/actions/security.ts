"use server";

import { headers } from "next/headers";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { renderSVG } from "uqr";
import { z } from "zod";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { isOwnMagicLink } from "@/app/_lib/magic-link";
import { requireAppServices } from "@/app/_lib/session";
import { authConfig } from "@/config/auth";
import { hasSecondFactor } from "@/core/auth";
import { isAppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";

const localeSchema = z.enum(["vi", "en"]).catch("vi");
const code = z.string().trim().min(6).max(32);
const securityPage = (locale: string, result: string) => localePath(locale, `${authConfig.securityPath}?result=${result}`);

/** A same-site, locale-less path to return to after verifying (never an absolute or protocol-relative URL). */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/admin";
}

// Better Auth rejects a factor change without a fresh second factor (adapter "before" hook) with 403.
const isForbidden = (error: unknown) => (error as { statusCode?: number })?.statusCode === 403 || (error as { status?: unknown })?.status === "FORBIDDEN";
const isLocked = (error: unknown) =>
  (isAppError(error) && error.code === "RATE_LIMIT_ERROR") || (error as { statusCode?: number })?.statusCode === 429 || (error as { status?: unknown })?.status === "TOO_MANY_REQUESTS";

async function signedIn() {
  const app = await requireAppServices();
  const h = await headers();
  const current = await app.auth.getSession(h);
  if (!current) notFound();
  return { app, h, current };
}

const isWrongPassword = (error: unknown) => isAppError(error) && error.code === "VALIDATION_ERROR";
// Optional: an account with a password gives it again for authenticator-app changes.
const passwordOf = (formData?: FormData) => String(formData?.get("password") ?? "") || undefined;

/**
 * Second factor: TOTP or a backup code (form field `kind`), for this session or to finish a password sign-in waiting
 * for it. Then back to `next`.
 */
export async function verifySecondFactor(formData: FormData): Promise<void> {
  const app = await requireAppServices();
  const h = await headers();
  const pending = !(await app.auth.getSession(h));
  if (pending && !app.auth.hasPendingSecondFactor(h)) notFound();
  const locale = localeSchema.parse(formData.get("locale"));
  const next = safeNext(formData.get("next"));
  const parsed = code.safeParse(formData.get("code"));
  const backup = formData.get("kind") === "backup";
  let error = "wrong";
  if (parsed.success) {
    try {
      const value = backup ? parsed.data : parsed.data.replace(/\s/g, "");
      if (await (backup ? app.auth.security.verifyBackupCode(h, value) : app.auth.security.verifyTotp(h, value))) redirect(localePath(locale, next));
    } catch (e) {
      unstable_rethrow(e);
      // A password sign-in out of attempts starts over from the sign-in page.
      error = isLocked(e) ? (pending ? "expired" : "locked") : "failed";
    }
  }
  redirect(localePath(locale, `${authConfig.verifyPath}?error=${error}&next=${encodeURIComponent(next)}`));
}

export type TotpSetupState = { status: "setup"; qr: string; key: string; backupCodes: string[] } | { status: "fresh" } | { status: "password" } | { status: "failed" } | null;

/** Starts authenticator-app setup: QR code (SVG), setup key and backup codes, shown once. */
export async function startTotp(prev: TotpSetupState, formData?: FormData): Promise<TotpSetupState> {
  void prev; // useActionState signature
  const { app, h } = await signedIn();
  try {
    const { totpURI, backupCodes } = await app.auth.security.startTotp(h, passwordOf(formData));
    const key = new URL(totpURI).searchParams.get("secret") ?? "";
    return { status: "setup", qr: renderSVG(totpURI), key, backupCodes };
  } catch (e) {
    return { status: isForbidden(e) ? "fresh" : isWrongPassword(e) ? "password" : "failed" };
  }
}

/** First code from the app: confirms the setup (and passes the second factor for this session). */
export async function confirmTotp(formData: FormData): Promise<void> {
  const { app, h } = await signedIn();
  const locale = localeSchema.parse(formData.get("locale"));
  const parsed = code.safeParse(formData.get("code"));
  let result = "wrong";
  if (parsed.success) {
    try {
      if (await app.auth.security.verifyTotp(h, parsed.data.replace(/\s/g, ""))) result = "done";
    } catch (e) {
      result = isLocked(e) ? "locked" : "failed";
    }
  }
  redirect(securityPage(locale, result));
}

export async function disableTotp(formData: FormData): Promise<void> {
  const { app, h, current } = await signedIn();
  const locale = localeSchema.parse(formData.get("locale"));
  const factors = await app.auth.factors(current.user.id);
  let result = "done";
  if (mustKeep(current.user.role, { passkeys: factors.passkeys, totp: false }, app.auth.staffPolicy.requireSecondFactor)) result = "last";
  else {
    try {
      await app.auth.security.disableTotp(h, passwordOf(formData));
    } catch (e) {
      result = isForbidden(e) ? "fresh" : isWrongPassword(e) ? "password" : "failed";
    }
  }
  redirect(securityPage(locale, result));
}

export type BackupCodesState = { status: "codes"; codes: string[] } | { status: "fresh" } | { status: "password" } | { status: "failed" } | null;

export async function newBackupCodes(prev: BackupCodesState, formData?: FormData): Promise<BackupCodesState> {
  void prev; // useActionState signature
  const { app, h } = await signedIn();
  try {
    return { status: "codes", codes: await app.auth.security.newBackupCodes(h, passwordOf(formData)) };
  } catch (e) {
    return { status: isForbidden(e) ? "fresh" : isWrongPassword(e) ? "password" : "failed" };
  }
}

/**
 * Staff password: a first one, or a change (current password, other devices signed out). Needs a fresh second factor.
 * Result keys: done, fresh, wrong (current password), mismatch, too_short, too_long, compromised, failed.
 */
export async function savePassword(formData: FormData): Promise<void> {
  const { app, h, current } = await signedIn();
  const locale = localeSchema.parse(formData.get("locale"));
  const next = String(formData.get("password") ?? "");
  const currentPassword = String(formData.get("current") ?? "");
  let result: string;
  if (next !== String(formData.get("confirm") ?? "")) result = "mismatch";
  else {
    try {
      const outcome = (await app.auth.security.hasPassword(current.user.id))
        ? await app.auth.security.changePassword(h, currentPassword, next)
        : await app.auth.security.setPassword(h, next);
      result = outcome === "wrong" ? "password" : outcome === "invalid" ? "failed" : outcome;
    } catch (e) {
      result = isForbidden(e) ? "fresh" : "failed";
    }
  }
  redirect(securityPage(locale, result));
}

export async function deletePasskey(formData: FormData): Promise<void> {
  const { app, h, current } = await signedIn();
  const locale = localeSchema.parse(formData.get("locale"));
  const id = z.string().min(1).max(100).safeParse(formData.get("id"));
  if (!id.success) redirect(securityPage(locale, "failed"));
  const factors = await app.auth.factors(current.user.id);
  let result = "done";
  if (mustKeep(current.user.role, { passkeys: factors.passkeys - 1, totp: factors.totp }, app.auth.staffPolicy.requireSecondFactor)) result = "last";
  else {
    try {
      await app.auth.security.deletePasskey(h, id.data);
    } catch (e) {
      result = isForbidden(e) ? "fresh" : "failed";
    }
  }
  redirect(securityPage(locale, result));
}

export async function signOutDevice(formData: FormData): Promise<void> {
  const { app, h } = await signedIn();
  const locale = localeSchema.parse(formData.get("locale"));
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await app.auth.security.signOutDevice(h, id.data);
  redirect(securityPage(locale, id.success ? "done" : "failed"));
}

export async function signOutOtherDevices(formData: FormData): Promise<void> {
  const { app, h } = await signedIn();
  await app.auth.security.signOutOtherDevices(h);
  redirect(securityPage(localeSchema.parse(formData.get("locale")), "done"));
}

/** Staff must keep at least one second factor while the policy requires it. */
function mustKeep(role: string, after: { passkeys: number; totp: boolean }, required: boolean): boolean {
  return required && (role === "editor" || role === "admin") && !hasSecondFactor(after);
}

export type LoginCodeState = { status: "ok"; link: string } | { status: "wrong" } | { status: "rate_limited" } | { status: "error" } | null;

/**
 * The 6-digit code from the sign-in email: returns the same one-time link for the browser to open. Never
 * redirect() to it from here: Next.js would follow a same-site redirect on the server, using the link up there and
 * leaving the session cookie with the server instead of the browser.
 */
export async function signInWithCode(_prev: LoginCodeState, formData: FormData): Promise<LoginCodeState> {
  const app = await requireAppServices();
  const email = z.email().max(200).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const value = z.string().trim().regex(/^\d{6}$/).safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!email.success || !value.success) return { status: "wrong" };
  let link: string | null = null;
  try {
    link = await app.auth.redeemLoginCode({ email: email.data, code: value.data, clientKey: clientKeyFrom(await headers()) });
  } catch (e) {
    if (isAppError(e) && e.code === "RATE_LIMIT_ERROR") return { status: "rate_limited" };
    return { status: "error" };
  }
  if (!link || !isOwnMagicLink(link)) return { status: "wrong" };
  return { status: "ok", link };
}
