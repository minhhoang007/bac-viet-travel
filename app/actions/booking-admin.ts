"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import { addDays } from "@/product/booking/rules";

const locale = z.enum(["vi", "en"]).catch("vi");
const code = z.string().regex(/^BV-[A-Z2-9]{6}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Thin actions: admin guard → validate → booking admin service (audited) → back to the page with a result flag. */
async function run(formData: FormData, back: string, work: (ctx: Awaited<ReturnType<typeof requireAdmin>>) => Promise<boolean>) {
  const ctx = await requireAdmin();
  const l = locale.parse(formData.get("locale"));
  let ok = false;
  try {
    ok = await work(ctx);
  } catch (error) {
    unstable_rethrow(error);
    ctx.container.logger.warn("booking_admin.action_failed", { error });
  }
  const sep = back.includes("?") ? "&" : "?";
  redirect(localePath(l, `${back}${sep}result=${ok ? "done" : "failed"}`));
}

const service = (ctx: Awaited<ReturnType<typeof requireAdmin>>) => ctx.container.app!.product.bookingAdmin;
const bookingCode = (formData: FormData) => code.parse(formData.get("code"));

export async function confirmBooking(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  await run(formData, `/admin/bookings/${c}`, (ctx) => service(ctx).confirm(ctx.user, c));
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  const reason = String(formData.get("reason") ?? "");
  const refund = formData.get("refund") === "on";
  await run(formData, `/admin/bookings/${c}`, (ctx) => service(ctx).cancel(ctx.user, c, { reason, refund }));
}

export async function markBookingRefunded(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  await run(formData, `/admin/bookings/${c}`, (ctx) => service(ctx).markRefunded(ctx.user, c, { note: String(formData.get("note") ?? "") }));
}

export async function saveStaffNote(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  await run(formData, `/admin/bookings/${c}`, (ctx) => service(ctx).setStaffNote(ctx.user, c, String(formData.get("note") ?? "")));
}

/** One date, or the same weekdays every week for N weeks starting at `from`. */
export async function addDepartures(formData: FormData): Promise<void> {
  const tourSlug = String(formData.get("tourSlug") ?? "");
  const from = day.parse(formData.get("from"));
  const weeks = z.coerce.number().int().min(1).max(26).catch(1).parse(formData.get("weeks"));
  const weekdays = formData.getAll("weekday").map(Number).filter((n) => n >= 0 && n <= 6);
  const capacity = z.coerce.number().int().catch(0).parse(formData.get("capacity"));
  const priceRaw = String(formData.get("priceVnd") ?? "").replace(/\D/g, "");
  const dates: string[] = [];
  if (weekdays.length === 0) dates.push(from);
  else for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(from, i);
    if (weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay())) dates.push(d);
  }
  await run(formData, `/admin/departures?tour=${encodeURIComponent(tourSlug)}`, async (ctx) =>
    (await service(ctx).addDepartures(ctx.user, { tourSlug, dates, capacity, priceVnd: priceRaw ? Number(priceRaw) : null })) > 0,
  );
}

export async function updateDeparture(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const back = String(formData.get("back") ?? "/admin/departures");
  const capacity = formData.get("capacity");
  const priceRaw = formData.get("priceVnd");
  const status = formData.get("status");
  await run(formData, back.startsWith("/admin/departures") ? back : "/admin/departures", (ctx) =>
    service(ctx).updateDeparture(ctx.user, id, {
      ...(capacity !== null && { capacity: Number(capacity) }),
      ...(priceRaw !== null && { priceVnd: String(priceRaw).replace(/\D/g, "") ? Number(String(priceRaw).replace(/\D/g, "")) : null }),
      ...((status === "open" || status === "closed") && { status }),
    }),
  );
}
