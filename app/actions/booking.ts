"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { BOOKING_COOKIE, getBooking, getDeposits, isTransferAvailable } from "@/app/_lib/booking";
import { getPublicEnv } from "@/bootstrap/env";
import { localePath } from "@/core/i18n/routing";
import type { HoldResult } from "@/product/booking/service";
import type { TravellersState } from "@/product/components/travellers-form";

export type HoldFormState = Exclude<HoldResult, { status: "held" }> | { status: "error" } | null;
export type DepositFormState = { status: "not_payable" | "error" } | null;

const localeOf = (formData: FormData) => (formData.get("locale") === "en" ? "en" : "vi");

/** Thin action: client key → booking service; on success go to the guest's private booking page. */
export async function holdSeats(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const raw = Object.fromEntries(formData);
  let result: HoldResult;
  try {
    result = await getBooking().hold(raw, clientKeyFrom(await headers()));
  } catch {
    return { status: "error" };
  }
  if (result.status !== "held") return result;
  redirect(localePath(localeOf(formData), `/booking/${result.code}?t=${result.token}`));
}

/** Private tour: same as holdSeats, with a guest-chosen date and group size. */
export async function holdPrivateSeats(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const raw = Object.fromEntries(formData);
  let result: HoldResult;
  try {
    result = await getBooking().holdPrivate(raw, clientKeyFrom(await headers()));
  } catch {
    return { status: "error" };
  }
  if (result.status !== "held") return result;
  redirect(localePath(localeOf(formData), `/booking/${result.code}?t=${result.token}`));
}

/** Starts a VNPay deposit for a held booking and sends the guest to VNPay. */
export async function startDeposit(_prev: DepositFormState, formData: FormData): Promise<DepositFormState> {
  const code = String(formData.get("code") ?? "");
  const token = String(formData.get("token") ?? "");
  const locale = localeOf(formData);
  let url: string;
  try {
    const result = await getDeposits().start({
      code,
      token,
      ipAddr: clientKeyFrom(await headers()),
      returnUrl: `${getPublicEnv().NEXT_PUBLIC_SITE_URL}${localePath(locale, "/booking/return")}`,
    });
    if (result.status !== "redirect") return { status: "not_payable" };
    url = result.url;
  } catch {
    return { status: "error" };
  }
  (await cookies()).set(BOOKING_COOKIE(code), token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
  redirect(url);
}

/** The guest pays by bank transfer: records it, holds the seats longer, back to the booking page with the QR. */
export async function chooseTransfer(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const token = String(formData.get("token") ?? "");
  const locale = localeOf(formData);
  let ok = false;
  try {
    ok = isTransferAvailable() && (await getDeposits().chooseTransfer({ code, token })).status === "ok";
  } catch {
    ok = false;
  }
  const back = `/booking/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`;
  redirect(localePath(locale, ok ? back : `${back}&pay=transfer_failed`));
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
