"use server";

import { adminAction } from "@/app/_lib/admin-action";
import { getBooking } from "@/app/_lib/booking";
import { headers } from "next/headers";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import type { Discount } from "@/product/booking/rules";

/** Thin admin actions (D6): admin guard → discount service (audited) → back to the list with a result flag. */
export async function createDiscount(formData: FormData): Promise<void> {
  await adminAction(formData, "/admin/discounts", "discounts.action_failed", async (ctx) => {
    const result = await ctx.container.app!.product.discounts.create(ctx.user, Object.fromEntries(formData));
    return result.status === "created" ? "done" : result.status === "taken" ? "taken" : `invalid&field=${encodeURIComponent(Object.keys(result.fieldErrors)[0] ?? "")}`;
  });
}

export async function updateDiscount(formData: FormData): Promise<void> {
  await adminAction(formData, "/admin/discounts", "discounts.action_failed", async (ctx) => {
    const id = String(formData.get("id") ?? "");
    const result = await ctx.container.app!.product.discounts.update(ctx.user, id, Object.fromEntries(formData));
    return result.status === "updated" ? "done" : result.status === "not_found" ? "failed" : `invalid&field=${encodeURIComponent(Object.keys(result.fieldErrors)[0] ?? "")}&edit=${encodeURIComponent(id)}`;
  });
}

export async function setDiscountActive(formData: FormData): Promise<void> {
  await adminAction(formData, "/admin/discounts", "discounts.action_failed", async (ctx) =>
    (await ctx.container.app!.product.discounts.setActive(ctx.user, String(formData.get("id") ?? ""), formData.get("active") === "1")) ? "done" : "failed",
  );
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
