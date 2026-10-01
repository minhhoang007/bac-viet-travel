import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import type { MailMessage } from "@/core/ports/mail";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import { testApp } from "@/tests/integration/setup/app";
import { testDb } from "@/tests/integration/setup/db";
import { bookingPayments, bookings, departures } from "../../schema/booking";
import { createDepositService } from "../deposits";
import { createBookingService } from "../service";

const { db, close } = testDb();
const logger = createLogger({ write: () => {} });
const VNPAY = { tmnCode: "BVTEST01", hashSecret: "test-hash-secret" };
// The real adapter, as product code gets it: ctx.payments.vnpay (configured by env).
const vnpay = testApp(db, { env: { VNPAY_TMN_CODE: VNPAY.tmnCode, VNPAY_HASH_SECRET: VNPAY.hashSecret } }).container.payments.vnpay!;

/** VNPay signature (as VNPay computes it on callbacks): HMAC-SHA512 over sorted, encoded vnp_* params. */
const encode = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");
const vnpaySign = (params: Record<string, string>, secret: string) =>
  createHmac("sha512", secret)
    .update(Object.keys(params).filter((k) => k.startsWith("vnp_") && k !== "vnp_SecureHash").sort().map((k) => `${encode(k)}=${encode(params[k]!)}`).join("&"))
    .digest("hex");
let clock = new Date("2026-10-01T03:00:00Z");
let sent: MailMessage[] = [];

const bookingService = createBookingService({
  db,
  logger,
  rateLimiter: createMemoryRateLimiter({ max: 1000, windowMs: 60_000 }),
  tourPrice: () => 1_000_000,
  now: () => clock,
});
const deposits = createDepositService({
  db,
  logger,
  mail: { send: async (m) => void sent.push(m) },
  bookings: bookingService,
  vnpay,
  tourTitle: () => "Ninh Bình 1 ngày",
  now: () => clock,
});
const LINKS = { siteUrl: "https://bacviet.example", teamEmail: "team@example.com" };

async function holdOn(capacity: number, adults = 1) {
  const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-10", capacity }).returning();
  const held = await bookingService.hold({ departureId: d!.id, name: "Lan", email: "lan@example.com", phone: "0912345678", adults: String(adults), locale: "vi" }, "ip");
  if (held.status !== "held") throw new Error(held.status);
  return { departure: d!, ...held };
}

async function startPayment(code: string, token: string) {
  const result = await deposits.start({ code, token, ipAddr: "1.2.3.4", returnUrl: "https://bacviet.example/booking/return" });
  if (result.status !== "redirect") throw new Error(result.status);
  return Object.fromEntries(new URL(result.url).searchParams);
}

/** What VNPay sends back: the request params plus result fields, re-signed with the merchant secret. */
function ipn(request: Record<string, string>, overrides: Record<string, string> = {}) {
  const params: Record<string, string> = {
    vnp_TmnCode: request.vnp_TmnCode!,
    vnp_TxnRef: request.vnp_TxnRef!,
    vnp_Amount: request.vnp_Amount!,
    vnp_OrderInfo: request.vnp_OrderInfo!,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14123456",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261001101500",
    ...overrides,
  };
  return { ...params, vnp_SecureHash: vnpaySign(params, VNPAY.hashSecret) };
}

const status = async (code: string) => (await db.select().from(bookings).where(eq(bookings.code, code)))[0]!;

beforeEach(async () => {
  clock = new Date("2026-10-01T03:00:00Z");
  sent = [];
  await db.execute(sql`TRUNCATE booking_payments, bookings, departures RESTART IDENTITY CASCADE`);
});
afterAll(() => close());

describe("booking deposits (VNPay)", () => {
  it("start: signed VNPay URL for exactly the deposit, expiring with the hold", async () => {
    const { code, token } = await holdOn(10, 2);
    const req = await startPayment(code, token);
    expect(req.vnp_Amount).toBe(String(600_000 * 100)); // 30% of 2 × 1,000,000
    expect(req.vnp_ExpireDate).toBe("20261001101500"); // 03:15 UTC = 10:15 Vietnam
    expect(vnpay.sandbox).toBe(true);
    expect((await deposits.start({ code, token: "x".repeat(32), ipAddr: "1", returnUrl: "https://x/r" })).status).toBe("not_found");
  });

  it("IPN success: deposit paid, link token erased, guest + team emailed with the private link", async () => {
    const { code, token } = await holdOn(10);
    const req = await startPayment(code, token);
    expect(await deposits.handleIpn(ipn(req), LINKS)).toEqual({ RspCode: "00", Message: "Confirm Success" });

    expect(await status(code)).toMatchObject({ status: "deposit_paid", depositPaidAt: clock });
    const [payment] = await db.select().from(bookingPayments);
    expect(payment).toMatchObject({ status: "paid", providerTxnNo: "14123456", bankCode: "NCB", linkToken: null });
    expect(sent.map((m) => [m.kind, m.to])).toEqual([["booking_deposit_paid", "lan@example.com"], ["booking_team_paid", "team@example.com"]]);
    expect(sent[0]!.text).toContain(`https://bacviet.example/booking/${code}?t=${token}`);
    expect(sent[1]!.text).not.toContain(token);

    // Paid seats stay taken after the hold time.
    clock = new Date(clock.getTime() + 60 * 60_000);
    expect((await bookingService.listDepartures("ninh-binh-day-tour"))[0]!.seatsLeft).toBe(9);
  });

  it("rejects a bad signature, an unknown order and a wrong amount; nothing changes", async () => {
    const { code, token } = await holdOn(10);
    const req = await startPayment(code, token);
    expect((await deposits.handleIpn({ ...ipn(req), vnp_ResponseCode: "24" }, LINKS)).RspCode).toBe("97"); // tampered after signing
    expect((await deposits.handleIpn(ipn(req, { vnp_TxnRef: "NOPE" }), LINKS)).RspCode).toBe("01");
    expect((await deposits.handleIpn(ipn(req, { vnp_Amount: "100" }), LINKS)).RspCode).toBe("04");
    expect((await status(code)).status).toBe("held");
    expect(sent).toEqual([]);
  });

  it("is idempotent: a repeated IPN answers 02 and sends nothing twice", async () => {
    const { code, token } = await holdOn(10);
    const req = await startPayment(code, token);
    const [a, b] = await Promise.all([deposits.handleIpn(ipn(req), LINKS), deposits.handleIpn(ipn(req), LINKS)]);
    expect([a.RspCode, b.RspCode].sort()).toEqual(["00", "02"]);
    expect(sent).toHaveLength(2);
  });

  it("failed payment: attempt marked failed, booking still held, guest can retry", async () => {
    const { code, token } = await holdOn(10);
    const req = await startPayment(code, token);
    expect((await deposits.handleIpn(ipn(req, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }), LINKS)).RspCode).toBe("00");
    expect((await status(code)).status).toBe("held");
    expect(await deposits.returnStatus(ipn(req, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }))).toEqual({ valid: true, code, status: "failed" });
    const retry = await startPayment(code, token);
    expect(retry.vnp_TxnRef).not.toBe(req.vnp_TxnRef);
  });

  it("late payment: accepted if seats are still free, refund_due if someone else took them", async () => {
    const first = await holdOn(1);
    const req = await startPayment(first.code, first.token);
    clock = new Date(clock.getTime() + 16 * 60_000); // hold expired, seat free again
    expect((await deposits.handleIpn(ipn(req), LINKS)).RspCode).toBe("00");
    expect((await status(first.code)).status).toBe("deposit_paid");

    await db.execute(sql`TRUNCATE booking_payments, bookings, departures RESTART IDENTITY CASCADE`);
    sent = [];
    clock = new Date("2026-10-01T03:00:00Z");
    const late = await holdOn(1);
    const lateReq = await startPayment(late.code, late.token);
    clock = new Date(clock.getTime() + 16 * 60_000);
    const other = await bookingService.hold({ departureId: late.departure.id, name: "Bao", email: "b@example.com", phone: "0912345679", adults: "1", locale: "vi" }, "ip2");
    expect(other.status).toBe("held");
    expect((await deposits.handleIpn(ipn(lateReq), LINKS)).RspCode).toBe("00");
    expect((await status(late.code)).status).toBe("refund_due");
    expect(sent.map((m) => m.kind)).toEqual(["booking_refund_due", "booking_team_refund"]);
  });

  it("return URL: pending until the IPN arrives, then paid; forged params are invalid", async () => {
    const { code, token } = await holdOn(10);
    const req = await startPayment(code, token);
    expect(await deposits.returnStatus(ipn(req))).toEqual({ valid: true, code, status: "pending" });
    await deposits.handleIpn(ipn(req), LINKS);
    expect(await deposits.returnStatus(ipn(req))).toEqual({ valid: true, code, status: "paid" });
    expect((await deposits.returnStatus({ ...ipn(req), vnp_Amount: "1" })).valid).toBe(false);
  });
});
