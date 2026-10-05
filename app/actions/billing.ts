"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/bootstrap/container";
import { getPublicEnv } from "@/bootstrap/env";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { currentUser } from "@/app/_lib/session";
import { isAppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";

const input = z.object({ locale: z.enum(["vi", "en"]).catch("vi"), interval: z.enum(["month", "year"]).catch("month") });

async function context(formData: FormData) {
  const { billing } = getContainer();
  if (!billing) notFound();
  const { locale, interval } = input.parse({ locale: formData.get("locale"), interval: formData.get("interval") });
  const { user } = await currentUser();
  if (!user) redirect(localePath(locale, "/login"));
  const absolute = (path: string) => new URL(localePath(locale, path), getPublicEnv().NEXT_PUBLIC_SITE_URL).toString();
  return { billing, user, locale, interval, absolute };
}

/** Billing page error flag: too many attempts, or anything else (no provider details reach the page). */
const errorFlag = (error: unknown, fallback: string) => (isAppError(error) && error.code === "RATE_LIMIT_ERROR" ? "rate_limited" : fallback);

/** Thin actions: guard → validate → billing service → redirect to the provider. */
export async function startPolarCheckout(formData: FormData): Promise<void> {
  const { billing, user, locale, interval, absolute } = await context(formData);
  let url: string;
  try {
    url = await billing.createPolarCheckout(user, "pro", interval, absolute("/dashboard/billing?checkout=success"));
  } catch (error) {
    redirect(localePath(locale, `/dashboard/billing?error=${errorFlag(error, "checkout")}`));
  }
  redirect(url);
}

export async function openPolarPortal(formData: FormData): Promise<void> {
  const { billing, user, locale, absolute } = await context(formData);
  let url: string;
  try {
    url = await billing.createPolarPortal(user.id, absolute("/dashboard/billing"));
  } catch (error) {
    redirect(localePath(locale, `/dashboard/billing?error=${errorFlag(error, "portal")}`));
  }
  redirect(url);
}

export async function startVnpayPayment(formData: FormData): Promise<void> {
  const { billing, user, locale, interval, absolute } = await context(formData);
  let url: string;
  try {
    url = await billing.createVnpayPayment({
      user,
      plan: "pro",
      interval,
      ipAddr: clientKeyFrom(await headers()),
      returnUrl: absolute("/billing/vnpay-return"),
      locale,
    });
  } catch (error) {
    redirect(localePath(locale, `/dashboard/billing?error=${errorFlag(error, "checkout")}`));
  }
  redirect(url);
}
