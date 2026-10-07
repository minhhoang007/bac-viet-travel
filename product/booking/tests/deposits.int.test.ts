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
  tourPrice: async () => 1_000_000,
  now: () => clock,
});
const deposits = createDepositService({
  db,
  logger,
  mail: { send: async (m) => void sent.push(m) },
  bookings: bookingService,
  vnpay,
  transferHoldMinutes: 120,
  tourTitle: async () => "Ninh Bình 1 ngày",
  now: () => clock,
});
const LINKS = { siteUrl: "https://bacviet.example", teamEmail: "team@example.com" };

async function holdOn(capacity: number, adults = 1) {
  const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-10", capacity }).returning();
  const held = await bookingService.hold({ departureId: d!.id, name: "Lan", email: "lan@example.com", phone: "0912345678", adults: String(adults), locale: "vi", agree: "on" }, "ip");
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
    const other = await bookingService.hold({ departureId: late.departure.id, name: "Bao", email: "b@example.com", phone: "0912345679", adults: "1", locale: "vi", agree: "on" }, "ip2");
    expect(other.status).toBe("held");
    expect((await deposits.handleIpn(ipn(lateReq), LINKS)).RspCode).toBe("00");
    expect((await status(late.code)).status).toBe("refund_due");
    expect(sent.map((m) => m.kind)).toEqual(["booking_refund_due", "booking_team_refund"]);
  });

  it("reconcile: a deposit paid at VNPay whose IPN was lost is confirmed before its hold expires; unpaid ones expire", async () => {
    const paid = await holdOn(10);
    const second = await bookingService.hold({ departureId: paid.departure.id, name: "Minh", email: "minh@example.com", phone: "0912345679", adults: "1", locale: "vi", agree: "on" }, "ip2");
    if (second.status !== "held") throw new Error(second.status);
    const unpaid = second;
    const paidReq = await startPayment(paid.code, paid.token);
    await startPayment(unpaid.code, unpaid.token);
    const asked: { txnRef: string; createdAt: Date }[] = [];
    // The adapter's query() (tested in the starter), answered here: VNPay has the first payment, not the second.
    const reconciling = createDepositService({
      db,
      logger,
      mail: { send: async (m) => void sent.push(m) },
      bookings: bookingService,
      transferHoldMinutes: 120,
      vnpay: {
        ...vnpay,
        query: async (input) => {
          asked.push(input);
          return input.txnRef === paidReq.vnp_TxnRef
            ? { status: "paid", params: { vnp_TxnRef: input.txnRef, vnp_Amount: paidReq.vnp_Amount!, vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "15695332", vnp_BankCode: "NCB" } }
            : { status: "unpaid" };
        },
      },
      tourTitle: async () => "Ninh Bình 1 ngày",
      now: () => clock,
    });

    expect(await reconciling.reconcile(LINKS)).toBe(0); // holds still running: wait for the IPN
    expect(asked).toEqual([]);

    clock = new Date(clock.getTime() + 16 * 60_000);
    expect(await reconciling.reconcile(LINKS)).toBe(1);
    await bookingService.expireStale();
    expect((await status(paid.code)).status).toBe("deposit_paid");
    expect((await status(unpaid.code)).status).toBe("expired");
    expect(sent.map((m) => m.kind)).toEqual(["booking_deposit_paid", "booking_team_paid", "booking_team_reconcile"]);
    // The team learns that an IPN was lost, with the booking code.
    expect(sent[2]).toMatchObject({ to: "team@example.com", subject: "[Đối soát VNPay] 1 thanh toán không có IPN" });
    expect(sent[2]!.text).toContain(paid.code);
    // Still inside VNPay's window at 16 minutes: the unpaid attempt stays pending; past it, it is closed (not asked again).
    const attempt = async () => (await db.select().from(bookingPayments).where(eq(bookingPayments.status, "pending"))).length;
    expect(await attempt()).toBe(1);
    clock = new Date(clock.getTime() + 10 * 60_000);
    // createdAt is the database clock; move it to the test clock (30 minutes ago).
    await db.update(bookingPayments).set({ createdAt: new Date(clock.getTime() - 30 * 60_000) }).where(eq(bookingPayments.status, "pending"));
    await reconciling.reconcile(LINKS);
    expect(await attempt()).toBe(0);
    // VNPay is asked with the attempt's stored creation time, the vnp_CreateDate of its payment URL.
    const gmt7 = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().replace(/\D/g, "").slice(0, 14);
    expect(gmt7(asked.find((a) => a.txnRef === paidReq.vnp_TxnRef)!.createdAt)).toBe(paidReq.vnp_CreateDate);

    expect(await reconciling.reconcile(LINKS)).toBe(0); // paid now; the unpaid one is asked again but stays unpaid
  });

  it("reconcile: when VNPay cannot be asked, the team is told; nothing to report sends nothing", async () => {
    const { code, token } = await holdOn(10);
    await startPayment(code, token);
    let down = true;
    const reconciling = createDepositService({
      db,
      logger,
      mail: { send: async (m) => void sent.push(m) },
      bookings: bookingService,
      transferHoldMinutes: 120,
      vnpay: { ...vnpay, query: async () => (down ? Promise.reject(new Error("VNPay querydr responded 503")) : { status: "unpaid" as const }) },
      tourTitle: async () => "Ninh Bình 1 ngày",
      now: () => clock,
    });
    clock = new Date(clock.getTime() + 16 * 60_000);
    expect(await reconciling.reconcile(LINKS)).toBe(0);
    expect(sent.map((m) => m.kind)).toEqual(["booking_team_reconcile"]);
    expect(sent[0]!.subject).toBe("[Đối soát VNPay] Không hỏi được VNPay (1)");
    down = false;
    sent = [];
    expect(await reconciling.reconcile(LINKS)).toBe(0);
    expect(sent).toEqual([]);
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

describe("booking deposits (bank transfer, VietQR)", () => {
  it("choosing a transfer holds the seats for the transfer time; staff record it once; guest + team emailed", async () => {
    const { code, token } = await holdOn(10, 2);
    expect(await deposits.chooseTransfer({ code, token })).toEqual({ status: "ok" });
    expect(await deposits.chooseTransfer({ code, token })).toEqual({ status: "ok" }); // twice: still one attempt
    expect((await status(code)).holdExpiresAt).toEqual(new Date(clock.getTime() + 120 * 60_000));
    const [booking] = await db.select().from(bookings).where(eq(bookings.code, code));
    expect(await deposits.transferPending(booking!.id)).toBe(true);
    expect(await db.select().from(bookingPayments)).toHaveLength(1);

    // 1 hour later (past the 15-minute online hold): still held.
    clock = new Date(clock.getTime() + 60 * 60_000);
    expect((await bookingService.listDepartures("ninh-binh-day-tour"))[0]!.seatsLeft).toBe(8);

    expect(await deposits.receiveTransfer(code, { amountVnd: 599_000, bankRef: "FT1" }, LINKS)).toBe("too_little");
    expect(await deposits.receiveTransfer(code, { amountVnd: 600_000, bankRef: " FT26100112345 " }, LINKS)).toBe("deposit_paid");
    expect(await status(code)).toMatchObject({ status: "deposit_paid", depositPaidAt: clock });
    const [payment] = await db.select().from(bookingPayments);
    expect(payment).toMatchObject({ method: "transfer", status: "paid", amountVnd: 600_000, providerTxnNo: "FT26100112345", linkToken: null });
    expect(sent.map((m) => m.kind)).toEqual(["booking_deposit_paid", "booking_team_paid"]);
    expect(sent[0]!.text).toContain(`https://bacviet.example/booking/${code}?t=${token}`);
    expect(await deposits.transferPending(booking!.id)).toBe(false);

    // Recorded once: a second click changes nothing.
    expect(await deposits.receiveTransfer(code, { amountVnd: 600_000, bankRef: "FT2" }, LINKS)).toBe("not_payable");
    expect(sent).toHaveLength(2);
  });

  it("a transfer the guest never chose on the site (and after the hold expired) is still recorded", async () => {
    const { code } = await holdOn(10);
    clock = new Date(clock.getTime() + 60 * 60_000);
    expect(await deposits.receiveTransfer(code, { amountVnd: 300_000, bankRef: "" }, LINKS)).toBe("deposit_paid");
    expect((await status(code)).status).toBe("deposit_paid");
  });

  it("late transfer with the seats gone: refund due, nothing oversold", async () => {
    const first = await holdOn(1);
    clock = new Date(clock.getTime() + 20 * 60_000); // first hold expired
    const second = await bookingService.hold({ departureId: first.departure.id, name: "Minh", email: "m@example.com", phone: "0912345679", adults: "1", locale: "vi", agree: "on" }, "ip");
    expect(second.status).toBe("held");
    expect(await deposits.receiveTransfer(first.code, { amountVnd: 300_000, bankRef: "FT9" }, LINKS)).toBe("refund_due");
    expect(await status(first.code)).toMatchObject({ status: "refund_due", refundDueVnd: 300_000 });
  });

  it("refuses an expired hold, a wrong token, and a paid booking; VNPay reconcile ignores transfers", async () => {
    const { code, token } = await holdOn(10);
    expect((await deposits.chooseTransfer({ code, token: "x".repeat(32) })).status).toBe("not_found");
    await deposits.chooseTransfer({ code, token });
    clock = new Date(clock.getTime() + 3 * 60 * 60_000);
    expect((await deposits.chooseTransfer({ code, token })).status).toBe("not_payable");
    expect(await deposits.reconcile(LINKS)).toBe(0); // no querydr for the pending transfer (vnpay.query would throw)
  });
});

describe("booking deposits (paid twice)", () => {
  it("a transfer arriving after a VNPay deposit is recorded as extra money owed back; the guest gets the right email", async () => {
    const { code, token } = await holdOn(10);
    await deposits.chooseTransfer({ code, token });
    expect((await deposits.handleIpn(ipn(await startPayment(code, token)), LINKS)).RspCode).toBe("00");
    expect((await status(code)).status).toBe("deposit_paid");
    sent = [];

    expect(await deposits.receiveTransfer(code, { amountVnd: 300_000, bankRef: "FT7" }, LINKS)).toBe("extra");
    expect(await status(code)).toMatchObject({ status: "deposit_paid", refundDueVnd: 300_000 });
    expect(sent.map((m) => m.kind)).toEqual(["booking_refund_due", "booking_team_refund"]);
    expect(sent[0]!.text).toContain("không còn chờ đặt cọc");
    expect(sent[0]!.text).not.toContain("không còn đủ chỗ");
    // Recorded once.
    expect(await deposits.receiveTransfer(code, { amountVnd: 300_000, bankRef: "FT7" }, LINKS)).toBe("not_payable");
  });

  it("a paid booking without a chosen transfer cannot take a staff-recorded transfer (nothing to match)", async () => {
    const { code, token } = await holdOn(10);
    await deposits.handleIpn(ipn(await startPayment(code, token)), LINKS);
    expect(await deposits.receiveTransfer(code, { amountVnd: 300_000, bankRef: "" }, LINKS)).toBe("not_payable");
  });
});

describe("balance payment (D5)", () => {
  async function paid() {
    const held = await holdOn(10, 2);
    expect((await deposits.handleIpn(ipn(await startPayment(held.code, held.token)), LINKS)).RspCode).toBe("00");
    sent = [];
    return held;
  }
  async function startBalance(code: string, token: string) {
    const result = await deposits.startBalance({ code, token, ipAddr: "1.2.3.4", returnUrl: "https://bacviet.example/booking/return" });
    if (result.status !== "redirect") throw new Error(result.status);
    return Object.fromEntries(new URL(result.url).searchParams);
  }

  it("pays the rest of the total online once; guest + team emailed; nothing more to pay", async () => {
    const { code, token } = await paid();
    const req = await startBalance(code, token);
    expect(req.vnp_Amount).toBe(String(1_400_000 * 100)); // 2,000,000 − 600,000 deposit
    expect(await deposits.handleIpn(ipn(req), LINKS)).toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect(await status(code)).toMatchObject({ status: "deposit_paid", balancePaidAt: clock, refundDueVnd: 0 });
    expect(sent.map((m) => m.kind)).toEqual(["booking_balance_paid", "booking_team_balance"]);
    expect((await deposits.startBalance({ code, token, ipAddr: "1", returnUrl: "https://x/r" })).status).toBe("not_payable");
    expect((await deposits.handleIpn(ipn(req), LINKS)).RspCode).toBe("02"); // replay
  });

  it("a held booking has no balance to pay", async () => {
    const held = await holdOn(10);
    expect((await deposits.startBalance({ code: held.code, token: held.token, ipAddr: "1", returnUrl: "https://x/r" })).status).toBe("not_payable");
  });

  it("a balance paid after cancelling is owed back", async () => {
    const { code, token } = await paid();
    const req = await startBalance(code, token);
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.code, code));
    expect((await deposits.handleIpn(ipn(req), LINKS)).RspCode).toBe("00");
    expect(await status(code)).toMatchObject({ status: "cancelled", balancePaidAt: null, refundDueVnd: 1_400_000 });
  });
});
