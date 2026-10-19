"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { getBooking, getDeposits, guestBookingPath, isTransferAvailable, passesBotCheck, rememberGuestToken } from "@/app/_lib/booking";
import { getPublicEnv } from "@/bootstrap/env";
import { localePath } from "@/core/i18n/routing";
import type { HoldResult } from "@/product/booking/service";
import type { TravellersState } from "@/product/components/travellers-form";

/** captcha: the bot check (Turnstile, when configured) failed or expired; the guest ticks it again. */
export type HoldFormState = Exclude<HoldResult, { status: "held" }> | { status: "error" | "captcha" } | null;
export type DepositFormState = { status: "not_payable" | "rate_limited" | "error" } | null;

const localeOf = (formData: FormData) => (formData.get("locale") === "en" ? "en" : "vi");

/** Thin action: client key → booking service; on success go to the guest's private booking page. */
export async function holdSeats(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const raw = Object.fromEntries(formData);
  const clientKey = clientKeyFrom(await headers());
  if (!(await passesBotCheck(formData, clientKey))) return { status: "captcha" };
  let result: HoldResult;
  try {
    result = await getBooking().hold(raw, clientKey);
  } catch {
    return { status: "error" };
  }
  if (result.status !== "held") return result;
  await rememberGuestToken(result.code, result.token);
  redirect(guestBookingPath(localeOf(formData), result.code));
}

/** Private tour: same as holdSeats, with a guest-chosen date and group size. */
export async function holdPrivateSeats(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const raw = Object.fromEntries(formData);
  const clientKey = clientKeyFrom(await headers());
  if (!(await passesBotCheck(formData, clientKey))) return { status: "captcha" };
  let result: HoldResult;
  try {
    result = await getBooking().holdPrivate(raw, clientKey);
  } catch {
    return { status: "error" };
  }
  if (result.status !== "held") return result;
  await rememberGuestToken(result.code, result.token);
  redirect(guestBookingPath(localeOf(formData), result.code));
}

/** VNPay payment for the guest's booking (deposit or balance): creates the attempt and sends the guest to VNPay. */
async function payOnline(kind: "start" | "startBalance", formData: FormData): Promise<DepositFormState> {
  const code = String(formData.get("code") ?? "");
  const token = String(formData.get("token") ?? "");
  const locale = localeOf(formData);
  let url: string;
  try {
    const result = await getDeposits()[kind]({
      code,
      token,
      ipAddr: clientKeyFrom(await headers()),
      returnUrl: `${getPublicEnv().NEXT_PUBLIC_SITE_URL}${localePath(locale, "/booking/return")}`,
    });
    if (result.status === "rate_limited") return { status: "rate_limited" };
    if (result.status !== "redirect") return { status: "not_payable" };
    url = result.url;
  } catch {
    return { status: "error" };
  }
  // VNPay's return URL cannot carry the token: the cookie brings the guest back to their private page.
  await rememberGuestToken(code, token);
  redirect(url);
}

/** Starts a VNPay deposit for a held booking. */
export async function startDeposit(_prev: DepositFormState, formData: FormData): Promise<DepositFormState> {
  return payOnline("start", formData);
}

/** VNPay payment of the rest of the total (D5) for a paid booking. */
export async function startBalance(_prev: DepositFormState, formData: FormData): Promise<DepositFormState> {
  return payOnline("startBalance", formData);
}

/** The guest pays by bank transfer: records it, holds the seats longer, back to the booking page with the QR. */
export async function chooseTransfer(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const token = String(formData.get("token") ?? "");
  const locale = localeOf(formData);
  let ok = false;
  try {
    ok = (await isTransferAvailable()) && (await getDeposits().chooseTransfer({ code, token })).status === "ok";
  } catch {
    ok = false;
  }
  if (ok) await rememberGuestToken(code, token);
  redirect(guestBookingPath(locale, code, ok ? {} : { pay: "transfer_failed" }));
}

export type ResendLinkState = { status: "sent" | "rate_limited" | "error" } | null;

/** Lost booking link: a new one goes to the booking email when code and email match (same answer either way). */
export async function resendBookingLink(_prev: ResendLinkState, formData: FormData): Promise<ResendLinkState> {
  try {
    const status = await getBooking().resendLink(
      { code: String(formData.get("code") ?? "").slice(0, 20), email: String(formData.get("email") ?? "").slice(0, 200) },
      clientKeyFrom(await headers()),
      getPublicEnv().NEXT_PUBLIC_SITE_URL,
    );
    return { status };
  } catch {
    return { status: "error" };
  }
}

/** The guest's traveller list (D7), checked against the secret token; errors per row stay on the page. */
export async function saveTravellers(_prev: TravellersState, formData: FormData): Promise<TravellersState> {
  const values = Object.fromEntries([...formData].filter(([k, v]) => /^(name|year)_\d{1,2}$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 120)]));
  try {
    const result = await getBooking().saveTravellers(String(formData.get("code") ?? ""), String(formData.get("token") ?? ""), Object.fromEntries(formData));
    return { ...(result.status === "not_found" ? { status: "error" as const } : result), values };
  } catch {
    return { status: "error", values };
  }
}

