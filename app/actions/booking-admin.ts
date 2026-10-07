"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/_lib/admin";
import { adminAction, type AdminContext } from "@/app/_lib/admin-action";
import { AppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import type { ManualBookingResult } from "@/product/booking/admin";
import { addDays } from "@/product/booking/rules";

const locale = z.enum(["vi", "en"]).catch("vi");
const code = z.string().regex(/^BV-[A-Z2-9]{6}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const EVENT = "booking_admin.action_failed";

/** Thin actions: admin guard → validate → booking admin service (audited) → back to the page with a result flag. */
const run = (formData: FormData, back: string, work: (ctx: AdminContext) => Promise<boolean>) =>
  adminAction(formData, back, EVENT, async (ctx) => ((await work(ctx)) ? "done" : "failed"));

const service = (ctx: AdminContext) => ctx.container.app!.product.bookingAdmin;
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

export async function changeBookingDate(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  await adminAction(formData, `/admin/bookings/${c}`, EVENT, async (ctx) => {
    const r = await service(ctx).changeDate(ctx.user, c, String(formData.get("departureId") ?? ""));
    return r.status === "sold_out" ? `date_sold_out&left=${r.seatsLeft}` : `date_${r.status}`;
  });
}

export async function saveContact(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  await run(formData, `/admin/bookings/${c}`, (ctx) => service(ctx).updateContact(ctx.user, c, Object.fromEntries(formData)));
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
  // Invalid input (past dates, seats out of range) says so instead of a generic failure.
  await adminAction(formData, `/admin/departures?tour=${encodeURIComponent(tourSlug)}`, EVENT, async (ctx) => {
    try {
      return (await service(ctx).addDepartures(ctx.user, { tourSlug, dates, capacity, priceVnd: priceRaw ? Number(priceRaw) : null })) > 0 ? "done" : "failed";
    } catch (error) {
      if (error instanceof AppError && error.code === "VALIDATION_ERROR") return "dates";
      throw error;
    }
  });
}

export async function updateDeparture(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"));
  const back = String(formData.get("back") ?? "/admin/departures");
  const capacity = formData.get("capacity");
  const priceRaw = formData.get("priceVnd");
  const status = formData.get("status");
  // A capacity below the seats already taken comes back with the count, so the page can say why.
  await adminAction(formData, back.startsWith("/admin/departures") ? back : "/admin/departures", EVENT, async (ctx) => {
    try {
      const changed = await service(ctx).updateDeparture(ctx.user, id, {
        ...(capacity !== null && { capacity: Number(capacity) }),
        ...(priceRaw !== null && { priceVnd: String(priceRaw).replace(/\D/g, "") ? Number(String(priceRaw).replace(/\D/g, "")) : null }),
        ...((status === "open" || status === "closed") && { status }),
      });
      return changed ? "done" : "failed";
    } catch (error) {
      const taken = error instanceof AppError ? error.details?.taken : undefined;
      if (typeof taken === "number") return `capacity&taken=${taken}`;
      throw error;
    }
  });
}

export type ManualBookingState = Exclude<ManualBookingResult, { status: "created" }> | { status: "error" } | null;

/** Staff-entered booking (phone, Zalo, OTA). Validation and seat checks live in the service; success opens the booking. */
export async function createManualBooking(_prev: ManualBookingState, formData: FormData): Promise<ManualBookingState> {
  const ctx = await requireAdmin();
  const l = locale.parse(formData.get("locale"));
  let result: ManualBookingResult;
  try {
    result = await service(ctx).createManual(ctx.user, Object.fromEntries(formData));
  } catch (error) {
    ctx.container.logger.warn(EVENT, { error });
    return { status: "error" };
  }
  if (result.status !== "created") return result;
  redirect(localePath(l, `/admin/bookings/${result.code}?result=done`));
}

/** Staff saw the bank transfer: records the deposit (audited); the page shows too_little / refund_due outcomes. */
export async function receiveTransfer(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  const amountVnd = z.coerce.number().int().positive().catch(0).parse(String(formData.get("amountVnd") ?? "").replace(/\D/g, ""));
  const bankRef = String(formData.get("bankRef") ?? "");
  await adminAction(formData, `/admin/bookings/${c}`, EVENT, async (ctx) => {
    const outcome = await service(ctx).receiveTransfer(ctx.user, c, { amountVnd, bankRef });
    return outcome === "deposit_paid" ? "done" : outcome === "too_little" || outcome === "refund_due" || outcome === "extra" ? outcome : "failed";
  });
}

export async function markBalancePaid(formData: FormData): Promise<void> {
  const c = bookingCode(formData);
  await run(formData, `/admin/bookings/${c}`, (ctx) => service(ctx).markBalancePaid(ctx.user, c, String(formData.get("note") ?? "")));
}
