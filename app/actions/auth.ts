"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getContainer } from "@/bootstrap/container";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { requireAppServices } from "@/app/_lib/session";
import { isAppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";

export type MagicLinkState =
  | { status: "sent" }
  | { status: "invalid_email" }
  | { status: "rate_limited" }
  | { status: "captcha" }
  | { status: "error" }
  | null;

const emailSchema = z.email().max(200);
const localeSchema = z.enum(["vi", "en"]).catch("vi");

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const app = await requireAppServices();
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "invalid_email" };
  const locale = localeSchema.parse(formData.get("locale"));
  const h = await headers();
  try {
    await app.auth.signInMagicLink(
      {
        email: email.data,
        callbackURL: localePath(locale, authConfig.afterSignInPath),
        errorCallbackURL: localePath(locale, authConfig.signInPath), // Better Auth appends ?error=<CODE>
        clientKey: clientKeyFrom(h),
        captchaToken: String(formData.get("cf-turnstile-response") ?? "") || null,
      },
      h,
    );
    return { status: "sent" };
  } catch (error) {
    if (isAppError(error) && error.code === "RATE_LIMIT_ERROR") return { status: "rate_limited" };
    if (isAppError(error) && error.code === "CAPTCHA_ERROR") return { status: "captcha" };
    return { status: "error" };
  }
}

export type PasswordSignInState = { status: "wrong" } | { status: "email_link" } | { status: "rate_limited" } | { status: "captcha" } | { status: "error" } | null;

/** Email and password (staff). The authenticator app on: the verify page asks for its code before any session. */
export async function signInWithPassword(_prev: PasswordSignInState, formData: FormData): Promise<PasswordSignInState> {
  const app = await requireAppServices();
  const locale = localeSchema.parse(formData.get("locale"));
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) return { status: "wrong" };
  const h = await headers();
  let status: "ok" | "second_factor" | "email_link" | "wrong";
  try {
    ({ status } = await app.auth.signInPassword({ email: email.data, password, clientKey: clientKeyFrom(h), captchaToken: String(formData.get("cf-turnstile-response") ?? "") || null }, h));
  } catch (error) {
    if (isAppError(error) && error.code === "RATE_LIMIT_ERROR") return { status: "rate_limited" };
    if (isAppError(error) && error.code === "CAPTCHA_ERROR") return { status: "captcha" };
    return { status: "error" };
  }
  // No second factor yet: sign in by email link first (the security page then sets one up).
  if (status === "wrong" || status === "email_link") return { status };
  const next = authConfig.afterSignInPath;
  redirect(localePath(locale, status === "ok" ? next : `${authConfig.verifyPath}?next=${encodeURIComponent(next)}`));
}

export type PasswordResetRequestState = { status: "sent" } | { status: "invalid_email" } | { status: "rate_limited" } | { status: "captcha" } | { status: "error" } | null;

/** "Forgot password": the same answer, in the same time, whether or not the address is a staff account. */
export async function requestPasswordReset(_prev: PasswordResetRequestState, formData: FormData): Promise<PasswordResetRequestState> {
  const app = await requireAppServices();
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "invalid_email" };
  const h = await headers();
  // The lookup and the email run after the answer (a mail outage is logged; the person can ask again).
  const defer = (work: () => Promise<void>) =>
    after(async () => {
      try {
        await work();
      } catch (error) {
        getContainer().logger.warn("auth.password_link_failed", { error });
      }
    });
  try {
    await app.auth.requestPasswordReset({ email: email.data, clientKey: clientKeyFrom(h), captchaToken: String(formData.get("cf-turnstile-response") ?? "") || null, defer });
    return { status: "sent" };
  } catch (error) {
    if (isAppError(error) && error.code === "RATE_LIMIT_ERROR") return { status: "rate_limited" };
    if (isAppError(error) && error.code === "CAPTCHA_ERROR") return { status: "captcha" };
    return { status: "error" };
  }
}

export type NewPasswordState = { status: "mismatch" | "too_short" | "too_long" | "compromised" | "invalid" | "error" } | null;

/** The new password from the emailed link; then sign in with it. */
export async function resetPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const app = await requireAppServices();
  const locale = localeSchema.parse(formData.get("locale"));
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { status: "mismatch" };
  let result;
  try {
    result = await app.auth.resetPassword(token, password);
  } catch {
    return { status: "error" };
  }
  if (result !== "done") return { status: result };
  redirect(localePath(locale, `${authConfig.signInPath}?reset=done`));
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