import { getContainer } from "@/bootstrap/container";

/** Booking services built in product/manifest.ts (profile app). */
export const getBooking = () => getContainer().app!.product.booking;
export const getDeposits = () => getContainer().app!.product.deposits;
export const isPaymentsSandbox = () => getContainer().app!.product.paymentsSandbox;

/** Cookie that brings the guest back to their private page after VNPay (the return URL cannot carry the token). */
export const BOOKING_COOKIE = (code: string) => `bk_${code}`;
