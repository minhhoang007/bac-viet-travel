import { getContainer } from "@/bootstrap/container";
import { bankTransferConfig } from "@/config/bank-transfer";

/** Booking services built in product/manifest.ts (profile app). */
export const getBooking = () => getContainer().app!.product.booking;
export const getDeposits = () => getContainer().app!.product.deposits;
export const isPaymentsSandbox = () => getContainer().app!.product.paymentsSandbox;
/** Online card / QR payments (VNPay) are configured. */
export const isVnpayConfigured = () => Boolean(getContainer().payments.vnpay);
/** Bank transfer (VietQR) is offered with a real account, or with the demo account in payments sandbox mode only. */
export const isTransferAvailable = () => !bankTransferConfig.demo || isPaymentsSandbox();

/** Cookie that brings the guest back to their private page after VNPay (the return URL cannot carry the token). */
export const BOOKING_COOKIE = (code: string) => `bk_${code}`;
