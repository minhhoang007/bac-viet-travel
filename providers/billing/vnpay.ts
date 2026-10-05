import { createHmac, timingSafeEqual } from "node:crypto";
import type { OneTimePaymentProvider, PaymentQueryResult } from "@/core/ports/payments";

/** VNPay 2.1.0 adapter (https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html). No SDK exists. */
export const VNPAY_SANDBOX_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const QUERY_URL = { sandbox: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction", production: "https://merchant.vnpay.vn/merchant_webapi/api/transaction" };
// querydr: fixed field order for the request and response checksums (VNPay docs, "Truy vấn kết quả thanh toán").
const QUERY_REQUEST_FIELDS = ["vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_TxnRef", "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo"];
const QUERY_RESPONSE_FIELDS = [
  "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode",
  "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount",
];

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

export function vnpayProvider(options: {
  tmnCode: string;
  hashSecret: string;
  paymentUrl?: string;
  /** querydr endpoint; defaults to sandbox or production after paymentUrl. */
  queryUrl?: string;
  fetch?: typeof fetch;
}): OneTimePaymentProvider {
  const sandbox = (options.paymentUrl ?? VNPAY_SANDBOX_URL) === VNPAY_SANDBOX_URL;
  const queryUrl = options.queryUrl ?? QUERY_URL[sandbox ? "sandbox" : "production"];
  const checksum = (fields: string[], values: Record<string, string>) =>
    createHmac("sha512", options.hashSecret).update(fields.map((k) => values[k] ?? "").join("|")).digest("hex");

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

    async query({ txnRef, createdAt }): Promise<PaymentQueryResult> {
      const request: Record<string, string> = {
        vnp_RequestId: crypto.randomUUID().replace(/-/g, ""),
        vnp_Version: "2.1.0",
        vnp_Command: "querydr",
        vnp_TmnCode: options.tmnCode,
        vnp_TxnRef: txnRef,
        vnp_TransactionDate: vnpayDate(createdAt),
        vnp_CreateDate: vnpayDate(new Date()),
        vnp_IpAddr: "127.0.0.1",
        vnp_OrderInfo: `Query ${txnRef}`,
      };
      request.vnp_SecureHash = checksum(QUERY_REQUEST_FIELDS, request);
      const res = await (options.fetch ?? fetch)(queryUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      if (!res.ok) throw new Error(`VNPay querydr responded ${res.status}`);
      const body = (await res.json()) as Record<string, string>;
      const received = String(body.vnp_SecureHash ?? "").toLowerCase();
      const expected = checksum(QUERY_RESPONSE_FIELDS, body);
      if (!/^[0-9a-f]{128}$/.test(received) || !timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"))) {
        throw new Error("VNPay querydr: invalid response signature");
      }
      if (body.vnp_ResponseCode === "91") return { status: "not_found" };
      if (body.vnp_ResponseCode !== "00" || body.vnp_TxnRef !== txnRef) throw new Error(`VNPay querydr failed: ${body.vnp_ResponseCode}`);
      if (body.vnp_TransactionStatus !== "00") return { status: "unpaid" };
      return {
        status: "paid",
        params: {
          vnp_TmnCode: options.tmnCode,
          vnp_TxnRef: txnRef,
          vnp_Amount: body.vnp_Amount ?? "",
          vnp_ResponseCode: "00",
          vnp_TransactionStatus: "00",
          vnp_TransactionNo: body.vnp_TransactionNo ?? "",
          vnp_BankCode: body.vnp_BankCode ?? "",
          vnp_PayDate: body.vnp_PayDate ?? "",
        },
      };
    },
  };
}
