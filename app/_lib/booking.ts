import { cookies } from "next/headers";
import { getContainer } from "@/bootstrap/container";
import { getEnv } from "@/bootstrap/env";
import { localePath } from "@/core/i18n/routing";
import { createTurnstileCheck, type TurnstileCheck } from "@/core/security/turnstile";
import { currentBank } from "./company";

/** Booking services built in product/manifest.ts (profile app). */
export const getBooking = () => getContainer().app!.product.booking;
export const getDeposits = () => getContainer().app!.product.deposits;
/** Post-trip feedback (E4); null outside profile app. */
export const getFeedback = () => getContainer().app?.product.feedback ?? null;
export const isPaymentsSandbox = () => getContainer().app!.product.paymentsSandbox;
/** Online card / QR payments (VNPay) are configured. */
export const isVnpayConfigured = () => Boolean(getContainer().payments.vnpay);
/** Bank transfer (VietQR) is offered with a real account, or with the demo account in payments sandbox mode only. */
export const isTransferAvailable = async () => !(await currentBank()).demo || isPaymentsSandbox();

/**
 * Cookie that holds the guest's secret token for their booking, so the page URL never carries it (ad and analytics
 * tags send the page URL to Google/Meta). The email link's `?t=` is moved here once (`/api/booking/[code]/open`).
 */
export const BOOKING_COOKIE = (code: string) => `bk_${code}`;

/** Remembers the guest's token for their booking (180 days: bookings are often made months ahead). */
export async function rememberGuestToken(code: string, token: string) {
  (await cookies()).set(BOOKING_COOKIE(code), token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 180 * 24 * 60 * 60 });
}

/** The guest's token for a booking, from the cookie. */
export async function guestToken(code: string): Promise<string | undefined> {
  return (await cookies()).get(BOOKING_COOKIE(code))?.value;
}

/** The guest's booking page (or its voucher) without any secret in the URL. */
export function guestBookingPath(locale: "vi" | "en", code: string, opts: { voucher?: boolean; pay?: string } = {}) {
  const path = localePath(locale, `/booking/${encodeURIComponent(code)}${opts.voucher ? "/voucher" : ""}`);
  return opts.pay ? `${path}?pay=${encodeURIComponent(opts.pay)}` : path;
}

/** Where a guest link with `?t=` goes first: it stores the token and returns to the clean booking URL. */
export function openBookingUrl(locale: "vi" | "en", code: string, token: string, opts: { voucher?: boolean; pay?: string } = {}) {
  const query = new URLSearchParams({ t: token, locale, ...(opts.voucher ? { to: "voucher" } : {}), ...(opts.pay ? { pay: opts.pay } : {}) });
  return `/api/booking/${encodeURIComponent(code)}/open?${query}`;
}

let turnstile: TurnstileCheck | undefined;
/**
 * Bot check of the booking forms (Cloudflare Turnstile): passes when the keys are not set, otherwise verifies the
 * token the widget put in the form (one use per token: the form asks for a fresh one after each answer).
 */
export async function passesBotCheck(formData: FormData, clientKey: string): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const token = formData.get("cf-turnstile-response");
  return (turnstile ??= createTurnstileCheck(secret))(typeof token === "string" ? token : null, clientKey);
}
