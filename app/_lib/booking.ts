import { getContainer } from "@/bootstrap/container";
import { getEnv } from "@/bootstrap/env";
import { createTurnstileCheck, type TurnstileCheck } from "@/core/security/turnstile";
import { bankTransferConfig } from "@/config/bank-transfer";

/** Booking services built in product/manifest.ts (profile app). */
export const getBooking = () => getContainer().app!.product.booking;
export const getDeposits = () => getContainer().app!.product.deposits;
/** Post-trip feedback (E4); null outside profile app. */
export const getFeedback = () => getContainer().app?.product.feedback ?? null;
export const isPaymentsSandbox = () => getContainer().app!.product.paymentsSandbox;
/** Online card / QR payments (VNPay) are configured. */
export const isVnpayConfigured = () => Boolean(getContainer().payments.vnpay);
/** Bank transfer (VietQR) is offered with a real account, or with the demo account in payments sandbox mode only. */
export const isTransferAvailable = () => !bankTransferConfig.demo || isPaymentsSandbox();

/** Cookie that brings the guest back to their private page after VNPay (the return URL cannot carry the token). */
export const BOOKING_COOKIE = (code: string) => `bk_${code}`;

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
