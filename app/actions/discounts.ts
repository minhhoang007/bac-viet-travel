"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/_lib/admin";
import { getBooking } from "@/app/_lib/booking";
import { localePath } from "@/core/i18n/routing";
import { headers } from "next/headers";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import type { Discount } from "@/product/booking/rules";

const locale = z.enum(["vi", "en"]).catch("vi");

/** Thin admin actions (D6): admin guard → discount service (audited) → back to the list with a result flag. */
export async function createDiscount(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const l = locale.parse(formData.get("locale"));
  let query = "result=failed";
  try {
    const result = await ctx.container.app!.product.discounts.create(ctx.user, Object.fromEntries(formData));
    query = result.status === "created" ? "result=done" : result.status === "taken" ? "result=taken" : `result=invalid&field=${encodeURIComponent(Object.keys(result.fieldErrors)[0] ?? "")}`;
  } catch (error) {
    unstable_rethrow(error);
    ctx.container.logger.warn("discounts.action_failed", { error });
  }
  redirect(localePath(l, `/admin/discounts?${query}`));
}

export async function setDiscountActive(formData: FormData): Promise<void> {
  const ctx = await requireAdmin();
  const l = locale.parse(formData.get("locale"));
  let ok = false;
  try {
    ok = await ctx.container.app!.product.discounts.setActive(ctx.user, String(formData.get("id") ?? ""), formData.get("active") === "1");
  } catch (error) {
    unstable_rethrow(error);
    ctx.container.logger.warn("discounts.action_failed", { error });
  }
  redirect(localePath(l, `/admin/discounts?result=${ok ? "done" : "failed"}`));
}

/** Booking form preview: what a code takes off this tour's total today (null = not valid). Public, read-only. */
export async function previewDiscount(code: string, tourSlug: string, totalVnd: number): Promise<Discount | null> {
  if (typeof code !== "string" || typeof tourSlug !== "string" || !Number.isInteger(totalVnd) || totalVnd < 0 || code.length > 40 || tourSlug.length > 120) return null;
  try {
    return await getBooking().checkDiscount(code, tourSlug, totalVnd, clientKeyFrom(await headers()));
  } catch {
    return null;
  }
}
