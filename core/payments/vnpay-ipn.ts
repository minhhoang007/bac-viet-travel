import type { Logger } from "@/core/logger";

/** The JSON body VNPay expects from an IPN endpoint. VNPay retries until it gets 00 or 02. */
export type VnpayIpnResult = { RspCode: "00" | "01" | "02" | "04" | "97" | "99"; Message: string };

/**
 * Handles one VNPay IPN whose signature is already verified. Returns null when the txnRef is not one of its
 * orders, so the next handler (product, then billing) gets a turn.
 */
export type VnpayIpnHandler = (params: Record<string, string>) => Promise<VnpayIpnResult | null>;

export const VNPAY_CONFIRMED: VnpayIpnResult = { RspCode: "00", Message: "Confirm Success" };

/**
 * The checks every VNPay order needs before it is updated: amount (VNPay sends x100) and still pending.
 * Returns the answer to send when the IPN must stop here, otherwise whether the payment succeeded.
 */
export function checkVnpayOrder(
  order: { amount: number; status: string },
  params: Record<string, string>,
): { stop: VnpayIpnResult } | { success: boolean } {
  if (Number(params.vnp_Amount) !== order.amount * 100) return { stop: { RspCode: "04", Message: "Invalid amount" } };
  if (order.status !== "pending") return { stop: { RspCode: "02", Message: "Order already confirmed" } };
  return { success: params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00" };
}

/** The one IPN endpoint: verify the signature once, then let each handler claim the order in turn. */
export function createVnpayIpn(deps: {
  verify: (params: Record<string, string>) => boolean;
  handlers: VnpayIpnHandler[];
  logger: Logger;
}): (params: Record<string, string>) => Promise<VnpayIpnResult> {
  return async (params) => {
    if (!deps.verify(params)) return { RspCode: "97", Message: "Invalid signature" };
    try {
      for (const handler of deps.handlers) {
        const result = await handler(params);
        if (result) return result;
      }
      return { RspCode: "01", Message: "Order not found" };
    } catch (error) {
      deps.logger.error("payments.vnpay_ipn_failed", { error });
      return { RspCode: "99", Message: "Unknown error" };
    }
  };
}
