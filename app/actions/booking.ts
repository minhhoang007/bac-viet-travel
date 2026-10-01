"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { getBooking } from "@/app/_lib/booking";
import { localePath } from "@/core/i18n/routing";
import type { HoldResult } from "@/product/booking/service";

export type HoldFormState = Exclude<HoldResult, { status: "held" }> | { status: "error" } | null;

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
  const locale = raw.locale === "en" ? "en" : "vi";
  redirect(localePath(locale, `/booking/${result.code}?t=${result.token}`));
}
