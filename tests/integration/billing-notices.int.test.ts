import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import type { MailMessage } from "@/core/ports/mail";
import { users } from "@/core/users/schema";
import { billingConfig } from "@/config/billing";
import { createBillingNotices } from "@/modules/billing";
import { billingOrders } from "@/modules/billing/schema";
import { createEntitlementsModule } from "@/modules/entitlements";
import { resetDb, testDb } from "./setup/db";

const handle = testDb();
const db = handle.db;
const DAY = 24 * 60 * 60_000;

let clock = new Date("2026-11-01T02:00:00Z");
const now = () => clock;
const ent = createEntitlementsModule(db, billingConfig.plans, now);
let queued: MailMessage[] = [];
let failQueue = false;
const notices = createBillingNotices({
  db,
  logger: createLogger({ write: () => {} }),
  entitlements: ent,
  plans: billingConfig.plans,
  async queueEmail(message) {
    if (failQueue) throw new Error("jobs table down");
    queued.push(message);
  },
  siteUrl: "https://shop.example",
  brand: "Shop",
  now,
});

async function user(status: "active" | "disabled" = "active") {
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.com`, status }).returning();
  return u!;
}

async function paidOrder(ownerId: string, paidAt = clock) {
  const [o] = await db
    .insert(billingOrders)
    .values({ ownerId, provider: "vnpay", plan: "pro", interval: "month", amount: 199_000, currency: "VND", status: "paid", txnRef: crypto.randomUUID(), providerTransactionId: "15695332", paidAt })
    .returning();
  await ent.grantPeriod({ ownerId, plan: "pro", source: "vnpay_order", sourceId: o!.id, days: 30 });
  return o!;
}

const kinds = () => queued.map((m) => m.kind).sort();

beforeEach(async () => {
  await resetDb(db);
  clock = new Date("2026-11-01T02:00:00Z");
  queued = [];
  failQueue = false;
});
afterAll(() => handle.close());

describe("billing lifecycle emails", () => {
  it("a VNPay payment: one receipt and one welcome, never twice however often the sender runs", async () => {
    const u = await user();
    await paidOrder(u.id);
    expect(await notices.sendDue()).toBe(2);
    expect(await notices.sendDue()).toBe(0);
    expect(kinds()).toEqual(["billing.receipt", "billing.welcome"]);
    const receipt = queued.find((m) => m.kind === "billing.receipt")!;
    expect(receipt.to).toBe(u.email);
    expect(receipt.text).toContain("199.000 VND");
    expect(receipt.text).toContain("https://shop.example/dashboard/billing");

    // A second purchase: a receipt, no second welcome.
    await paidOrder(u.id);
    await notices.sendDue();
    expect(kinds()).toEqual(["billing.receipt", "billing.receipt", "billing.welcome"]);
  });

  it("old payments (before the upgrade) get nothing", async () => {
    const u = await user();
    clock = new Date(clock.getTime() - 5 * DAY);
    await paidOrder(u.id);
    clock = new Date(clock.getTime() + 5 * DAY);
    expect(await notices.sendDue()).toBe(0);
  });

  it("reminders at 7, 3 and 1 days left, each once; skipped once renewed", async () => {
    const u = await user();
    await paidOrder(u.id); // ends in 30 days
    await notices.sendDue();
    queued = [];

    const reminderDays = async (daysBeforeEnd: number) => {
      clock = new Date(new Date("2026-12-01T02:00:00Z").getTime() - daysBeforeEnd * DAY);
      await notices.sendDue();
      return queued.filter((m) => m.kind === "billing.renewal_reminder").length;
    };
    expect(await reminderDays(10)).toBe(0);
    expect(await reminderDays(6.5)).toBe(1);
    expect(await reminderDays(6)).toBe(1); // same 7-day bucket
    expect(await reminderDays(2.5)).toBe(2);
    expect(queued.at(-1)!.subject).toContain("3 ngày");

    // Renewed before the last reminder: the 1-day reminder and "access ended" never go out.
    await paidOrder(u.id);
    queued = [];
    expect(await reminderDays(0.5)).toBe(0);
    clock = new Date("2026-12-01T05:00:00Z");
    await notices.sendDue();
    expect(queued.filter((m) => m.kind === "billing.access_ended")).toHaveLength(0);
  });

  it("access ended: once, after the last paid grant ends", async () => {
    const u = await user();
    await paidOrder(u.id);
    clock = new Date("2026-12-01T03:00:00Z"); // one hour after the end
    queued = [];
    await notices.sendDue();
    await notices.sendDue();
    expect(kinds()).toEqual(["billing.access_ended"]);
    expect(queued[0]!.text).toContain("miễn phí");
  });

  it("a disabled account is never mailed; a failed queue keeps nothing claimed, so the next run retries", async () => {
    const off = await user("disabled");
    await paidOrder(off.id);
    await notices.sendDue();
    expect(queued).toHaveLength(0);

    const u = await user();
    await paidOrder(u.id);
    failQueue = true;
    await expect(notices.sendDue()).rejects.toThrow("jobs table down");
    failQueue = false;
    await notices.sendDue();
    expect(kinds()).toEqual(["billing.receipt", "billing.welcome"]);
    expect(queued.every((m) => m.to === u.email)).toBe(true);
  });

  it("deleting the user removes their notices (cascade)", async () => {
    const u = await user();
    await paidOrder(u.id);
    await notices.sendDue();
    await db.delete(users).where(eq(users.id, u.id));
    const left = await db.execute(`select count(*)::int as n from billing_notices`);
    expect((left as unknown as { n: number }[])[0]!.n).toBe(0);
  });
});
