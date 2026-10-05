import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { featureDefaults } from "@/config/features.defaults";
import type { ProductContext } from "@/core/product/context";
import { checkVnpayOrder, VNPAY_CONFIRMED } from "@/core/payments/vnpay-ipn";
import { users } from "@/core/users/schema";
import type { SubscriptionProvider } from "@/modules/billing";
import { vnpaySign } from "@/providers/billing/vnpay";
import { resetDb, testDb } from "./setup/db";
import { testApp } from "./setup/app";

// A fake product that records its context and registers jobs (rc.10: G7 + G8).
const seen = vi.hoisted(() => ({ ctx: undefined as ProductContext | undefined, handled: [] as unknown[], ticks: 0, ipnThrows: false }));
vi.mock("@/product/manifest", () => ({
  createProduct: (_db: unknown, ctx: ProductContext) => {
    seen.ctx = ctx;
    return {
      services: {},
      exporters: [],
      jobs: {
        handlers: { "test.handle": async (payload: Record<string, unknown>) => void seen.handled.push(payload) },
        periodic: { "test.sweep": async () => void seen.ticks++ },
      },
      // A booking-style handler: claims txnRefs starting with "BK", one 150,000 VND pending order (rc.15).
      vnpayIpn: async (params: Record<string, string>) => {
        if (!params.vnp_TxnRef?.startsWith("BK")) return null;
        if (seen.ipnThrows) throw new Error("db down");
        const checked = checkVnpayOrder({ amount: 150_000, status: "pending" }, params);
        return "stop" in checked ? checked.stop : VNPAY_CONFIRMED;
      },
    };
  },
  productNav: [],
  sitemapPaths: [],
}));

const { db, close } = testDb();
const VNPAY = { VNPAY_TMN_CODE: "TESTTMN1", VNPAY_HASH_SECRET: "test-hash-secret" };

beforeEach(async () => {
  await resetDb(db);
  seen.ctx = undefined;
  seen.handled = [];
  seen.ticks = 0;
  seen.ipnThrows = false;
});
afterAll(() => close());

describe("product context (rc.10)", () => {
  it("gives createProduct db, logger, mail, rate limiter, clock and VNPay payments without the billing module", async () => {
    const { container } = testApp(db, { env: VNPAY });
    const ctx = seen.ctx!;
    expect(ctx.db).toBe(db);
    expect(typeof ctx.logger.info).toBe("function");
    expect(ctx.rateLimiter("x", { max: 1, windowMs: 1000 })).toBe(container.rateLimiter("x", { max: 1, windowMs: 1000 }));
    expect(ctx.now()).toBeInstanceOf(Date);
    expect(ctx.jobs).toBeUndefined(); // jobs module off
    expect(container.billing).toBeUndefined();

    const vnpay = ctx.payments.vnpay!;
    expect(vnpay.sandbox).toBe(true);
    const url = new URL(
      vnpay.buildPaymentUrl({ txnRef: "T1", amount: 150_000, orderInfo: "Deposit", ipAddr: "127.0.0.1", returnUrl: "http://localhost/r", locale: "vi", createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }),
    );
    expect(url.origin).toBe("https://sandbox.vnpayment.vn");
    expect(url.searchParams.get("vnp_Amount")).toBe("15000000");
    expect(vnpay.verify(Object.fromEntries(url.searchParams))).toBe(true);
    expect(container.payments).toBe(ctx.payments);
  });

  it("has no payments without VNPay env; production URL is not sandbox", () => {
    testApp(db);
    expect(seen.ctx!.payments.vnpay).toBeUndefined();
    testApp(db, { env: { ...VNPAY, VNPAY_PAYMENT_URL: "https://pay.vnpay.vn/vpcpay.html" } });
    expect(seen.ctx!.payments.vnpay!.sandbox).toBe(false);
  });

  describe("VNPay IPN endpoint (rc.15)", () => {
    const ipn = (txnRef: string, amount = 150_000) => {
      const params = { vnp_TmnCode: VNPAY.VNPAY_TMN_CODE, vnp_TxnRef: txnRef, vnp_Amount: String(amount * 100), vnp_ResponseCode: "00", vnp_TransactionStatus: "00" };
      return { ...params, vnp_SecureHash: vnpaySign(params, VNPAY.VNPAY_HASH_SECRET) };
    };

    it("routes product orders without the billing module: 00, 04, unknown 01, bad signature 97, handler error 99", async () => {
      const { container } = testApp(db, { env: VNPAY });
      const handle = container.handleVnpayIpn!;
      expect(await handle(ipn("BK1"))).toEqual(VNPAY_CONFIRMED);
      expect(await handle(ipn("BK1", 1_000))).toMatchObject({ RspCode: "04" });
      expect(await handle(ipn("XX1"))).toMatchObject({ RspCode: "01" });
      expect(await handle({ ...ipn("BK1"), vnp_Amount: "1" })).toMatchObject({ RspCode: "97" });
      seen.ipnThrows = true;
      expect(await handle(ipn("BK1"))).toEqual({ RspCode: "99", Message: "Unknown error" });
    });

    it("offers the order to the product first, then to billing (one IPN URL per merchant)", async () => {
      const polar = {} as SubscriptionProvider; // not called here
      const { container } = testApp(db, { saas: true, env: VNPAY, overrides: { billingProviders: { polar } } });
      const [owner] = await db.insert(users).values({ email: "buyer@example.com" }).returning();
      const url = await container.billing!.createVnpayPayment({ user: { id: owner!.id }, plan: "pro", interval: "month", ipAddr: "203.0.113.1", returnUrl: "https://x/r", locale: "vi" });
      const txnRef = new URL(url).searchParams.get("vnp_TxnRef")!;

      expect(await container.handleVnpayIpn!(ipn("BK2"))).toEqual(VNPAY_CONFIRMED);
      expect(await container.handleVnpayIpn!(ipn(txnRef, 199_000))).toEqual(VNPAY_CONFIRMED);
      expect((await container.entitlements!.getAccess(owner!.id)).plan).toBe("pro");
    });

    it("is absent without VNPay env, so the route answers 404", () => {
      expect(testApp(db).container.handleVnpayIpn).toBeUndefined();
    });
  });

  it("refuses a half-configured VNPay pair", () => {
    const app = { ...featureDefaults, profile: "app" as const };
    const base = { NEXT_PUBLIC_SITE_URL: "http://localhost:3000", DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "x".repeat(32) };
    expect(() => validateEnv({ ...base, VNPAY_TMN_CODE: "T" }, app, moduleManifests)).toThrow(/set both or neither/);
  });

  it("registers product job handlers and periodic tasks when the jobs module is on", async () => {
    const { container } = testApp(db, { modules: { jobs: true } });
    expect(seen.ctx!.jobs).toBeDefined();
    await seen.ctx!.jobs!.enqueue("test.handle", { id: 7 });
    await container.jobs!.tick();
    expect(seen.ticks).toBe(1);
    expect(seen.handled).toEqual([{ id: 7 }]);
  });

  it("gives product code the admin audit log when the admin module is on (rc.11)", async () => {
    const { container } = testApp(db, { modules: { admin: true } });
    const audit = seen.ctx!.audit!;
    const [staff] = await db.insert(users).values({ email: "staff@example.com", role: "admin" }).returning();
    const actor = { id: staff!.id, email: staff!.email };
    expect(await audit.audited(actor, { action: "order.confirm", targetType: "order", targetId: "A1" }, async () => true)).toBe(true);
    expect(await audit.audited(actor, { action: "order.noop", targetType: "order", targetId: "A1" }, async () => false)).toBe(false);
    const { rows } = await container.admin!.listAudit({ targetId: "A1" });
    expect(rows.map((r) => [r.action, r.actorEmail])).toEqual([["order.confirm", "staff@example.com"]]);

    testApp(db);
    expect(seen.ctx!.audit).toBeUndefined();
  });
});
