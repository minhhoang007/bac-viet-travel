import { createHmac, timingSafeEqual } from "node:crypto";
import type { OneTimePaymentProvider } from "@/modules/billing";

/** VNPay 2.1.0 adapter (https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html). No SDK exists. */
export const VNPAY_SANDBOX_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

// VNPay's reference implementation: encodeURIComponent with spaces as "+".
const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");

/** Sorted, encoded `key=value&…` string of vnp_* params, excluding the hash fields. */
export function vnpaySignData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType" && params[k] !== "")
    .sort()
    .map((k) => `${encode(k)}=${encode(params[k]!)}`)
    .join("&");
}

export function vnpaySign(params: Record<string, string>, secret: string): string {
  return createHmac("sha512", secret).update(Buffer.from(vnpaySignData(params), "utf8")).digest("hex");
}

/** yyyyMMddHHmmss in GMT+7 (VNPay requirement). */
export function vnpayDate(date: Date): string {
  const d = new Date(date.getTime() + 7 * 60 * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export function vnpayProvider(options: { tmnCode: string; hashSecret: string; paymentUrl?: string }): OneTimePaymentProvider {
  return {
    buildPaymentUrl({ txnRef, amount, orderInfo, ipAddr, returnUrl, locale, createdAt, expiresAt }) {
      const params: Record<string, string> = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: options.tmnCode,
        vnp_Amount: String(amount * 100),
        vnp_CurrCode: "VND",
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: "other",
        vnp_Locale: locale === "vi" ? "vn" : "en",
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: vnpayDate(createdAt),
        vnp_ExpireDate: vnpayDate(expiresAt),
      };
      const hash = vnpaySign(params, options.hashSecret);
      return `${options.paymentUrl ?? VNPAY_SANDBOX_URL}?${vnpaySignData(params)}&vnp_SecureHash=${hash}`;
    },

    verify(params) {
      const received = (params.vnp_SecureHash ?? "").toLowerCase();
      if (!/^[0-9a-f]{128}$/.test(received)) return false;
      if (params.vnp_TmnCode !== options.tmnCode) return false;
      const expected = vnpaySign(params, options.hashSecret);
      return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
    },
  };
}
