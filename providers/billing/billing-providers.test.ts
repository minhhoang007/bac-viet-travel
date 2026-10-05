import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookSignatureError } from "@/modules/billing";
import { polarProvider } from "./polar";
import { fakeVnpayQuery } from "@/tests/fakes/vnpay-query";
import { vnpayDate, vnpayProvider, vnpaySign, vnpaySignData } from "./vnpay";

describe("VNPay adapter", () => {
  const vnpay = vnpayProvider({ tmnCode: "TMN12345", hashSecret: "SECRETSECRETSECRETSECRETSECRET12" });

  it("formats dates as yyyyMMddHHmmss in GMT+7", () => {
    expect(vnpayDate(new Date("2026-09-30T20:15:05Z"))).toBe("20261001031505");
  });

  it("signs sorted, encoded params (spaces as +) excluding hash fields and empty values", () => {
    const data = vnpaySignData({ vnp_b: "x y", vnp_a: "1", vnp_SecureHash: "zz", vnp_SecureHashType: "SHA512", vnp_empty: "", other: "no" });
    expect(data).toBe("vnp_a=1&vnp_b=x+y");
  });

  it("payment URL verifies, and any tampering breaks it", () => {
    const url = vnpay.buildPaymentUrl({
      txnRef: "abc123",
      amount: 199_000,
      orderInfo: "Thanh toan goi pro 1 thang",
      ipAddr: "203.0.113.1",
      returnUrl: "https://example.com/billing/vnpay-return",
      locale: "vi",
      createdAt: new Date("2026-09-30T00:00:00Z"),
      expiresAt: new Date("2026-09-30T00:15:00Z"),
    });
    const params = Object.fromEntries(new URL(url).searchParams);
    expect(params.vnp_Amount).toBe("19900000");
    expect(vnpay.verify(params)).toBe(true);
    expect(vnpay.verify({ ...params, vnp_Amount: "100" })).toBe(false);
    expect(vnpay.verify({ ...params, vnp_TmnCode: "OTHER" })).toBe(false);
    expect(vnpay.verify({ ...params, vnp_SecureHash: "00" })).toBe(false);
  });

  it("hash matches an independent HMAC-SHA512 of the documented sign data", () => {
    const params = { vnp_TmnCode: "TMN12345", vnp_Amount: "100", vnp_TxnRef: "r1" };
    const expected = createHmac("sha512", "SECRETSECRETSECRETSECRETSECRET12").update("vnp_Amount=100&vnp_TmnCode=TMN12345&vnp_TxnRef=r1").digest("hex");
    expect(vnpaySign(params, "SECRETSECRETSECRETSECRETSECRET12")).toBe(expected);
  });
});

describe("VNPay querydr (reconcile when the IPN is lost)", () => {
  const secret = "SECRETSECRETSECRETSECRETSECRET12";
  const createdAt = new Date("2026-10-05T08:14:53.209Z");
  const provider = (fetch: typeof globalThis.fetch) => vnpayProvider({ tmnCode: "TMN12345", hashSecret: secret, fetch });

  it("paid → IPN-shaped params that the adapter's own IPN checks accept, request signed with the creation date", async () => {
    const fake = fakeVnpayQuery(secret, { T1: { amount: 150_000, status: "00" } });
    const result = await provider(fake.fetch).query({ txnRef: "T1", createdAt });
    expect(result).toEqual({ status: "paid", params: expect.objectContaining({ vnp_TxnRef: "T1", vnp_Amount: "15000000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "15695332" }) });
    const req = fake.requests[0]!;
    expect(req).toMatchObject({ vnp_Command: "querydr", vnp_TmnCode: "TMN12345", vnp_TxnRef: "T1", vnp_TransactionDate: "20261005151453" });
    const data = ["vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_TxnRef", "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo"].map((k) => req[k]).join("|");
    expect(req.vnp_SecureHash).toBe(createHmac("sha512", secret).update(data).digest("hex"));
  });

  it("unpaid, not found, and a forged response (throws, nothing confirmed)", async () => {
    const fake = fakeVnpayQuery(secret, { T2: { amount: 1, status: "01" } });
    expect(await provider(fake.fetch).query({ txnRef: "T2", createdAt })).toEqual({ status: "unpaid" });
    expect(await provider(fake.fetch).query({ txnRef: "nope", createdAt })).toEqual({ status: "not_found" });
    const forged = fakeVnpayQuery(secret, { T3: { amount: 1, status: "00" } }, { tamper: true });
    await expect(provider(forged.fetch).query({ txnRef: "T3", createdAt })).rejects.toThrow(/invalid response signature/);
  });
});

describe("Polar adapter (official SDK verification)", () => {
  // Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${body}` with the base64 key after "whsec_".
  const keyBytes = randomBytes(32);
  const secret = `whsec_${keyBytes.toString("base64")}`;
  const sign = (id: string, ts: string, body: string, key = keyBytes) =>
    `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
  const polar = polarProvider({ accessToken: "polar_oat_test", webhookSecret: secret, server: "sandbox" });

  const body = JSON.stringify({
    type: "subscription.active",
    timestamp: "2026-09-30T10:00:00Z",
    data: {
      id: "sub_123",
      status: "active",
      product_id: "prod_1",
      current_period_end: "2026-10-30T10:00:00Z",
      cancel_at_period_end: false,
      ended_at: null,
      created_at: "2026-09-30T10:00:00Z",
      modified_at: "2026-09-30T10:00:01Z",
      customer: { external_id: "user-1" },
    },
  });

  it("accepts a correctly signed event and normalizes the subscription", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sign("msg_1", ts, body) });
    const event = await polar.verifyWebhook(body, headers);
    expect(event).toMatchObject({ id: "msg_1", type: "subscription.active" });
    expect(event.subscription).toEqual({
      id: "sub_123",
      status: "active",
      productId: "prod_1",
      currentPeriodEnd: "2026-10-30T10:00:00Z",
      cancelAtPeriodEnd: false,
      endedAt: null,
      externalCustomerId: "user-1",
      updatedAt: "2026-09-30T10:00:01Z",
    });
  });

  it("rejects a forged signature and a tampered body", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const forged = new Headers({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sign("msg_1", ts, body, randomBytes(32)) });
    await expect(polar.verifyWebhook(body, forged)).rejects.toBeInstanceOf(WebhookSignatureError);

    const good = new Headers({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sign("msg_1", ts, body) });
    await expect(polar.verifyWebhook(body.replace("user-1", "attacker"), good)).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("rejects a stale timestamp (replay)", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const headers = new Headers({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sign("msg_1", ts, body) });
    await expect(polar.verifyWebhook(body, headers)).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});
