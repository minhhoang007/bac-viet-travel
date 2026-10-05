import { createHmac } from "node:crypto";

// Response checksum field order, written out independently of the adapter (VNPay docs, querydr).
const RESPONSE_FIELDS = [
  "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode",
  "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount",
];

export type FakeTransaction = { amount: number; status: "00" | "01" | "02" };

/** A fake VNPay querydr endpoint: answers for `transactions` (by txnRef), 91 for others, signed with `secret`. */
export function fakeVnpayQuery(secret: string, transactions: Record<string, FakeTransaction>, options: { tamper?: boolean } = {}) {
  const requests: Record<string, string>[] = [];
  const fakeFetch = (async (_url: string, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as Record<string, string>;
    requests.push(request);
    const tx = transactions[request.vnp_TxnRef!];
    const body: Record<string, string> = tx
      ? {
          vnp_ResponseId: "r1", vnp_Command: "querydr", vnp_ResponseCode: "00", vnp_Message: "QueryDR success", vnp_TmnCode: request.vnp_TmnCode!,
          vnp_TxnRef: request.vnp_TxnRef!, vnp_Amount: String(tx.amount * 100), vnp_BankCode: "NCB", vnp_PayDate: "20261005151533",
          vnp_TransactionNo: "15695332", vnp_TransactionType: "01", vnp_TransactionStatus: tx.status, vnp_OrderInfo: request.vnp_OrderInfo!,
        }
      : { vnp_ResponseId: "r2", vnp_Command: "querydr", vnp_ResponseCode: "91", vnp_Message: "Transaction not found", vnp_TmnCode: request.vnp_TmnCode!, vnp_TxnRef: request.vnp_TxnRef! };
    body.vnp_SecureHash = createHmac("sha512", options.tamper ? "wrong" : secret).update(RESPONSE_FIELDS.map((k) => body[k] ?? "").join("|")).digest("hex");
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { fetch: fakeFetch, requests };
}
