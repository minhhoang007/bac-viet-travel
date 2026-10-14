import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "@/tests/integration/setup/db";
import { bookingLedger, bookingPayments, bookings, departures } from "../../schema/booking";
import { owedVnd } from "../lifecycle";

// Migration 0016 builds the ledger from what bookings recorded before it: run its backfill on rows of that time.
const { db, close } = testDb();
const migration = readFileSync(join(process.cwd(), "db/migrations/product/0016_plain_the_call.sql"), "utf8");
const backfill = migration
  .slice(migration.indexOf("-- Backfill"))
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
});
afterAll(() => close());

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T03:00:00Z`);

describe("ledger backfill (migration 0016)", () => {
  it("deposits, balances, extra payments, OTA bookings and refunds become ledger rows; received and owed follow", async () => {
    const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-11-05", capacity: 20 }).returning();
    const b = (code: string, extra: Record<string, unknown>) => ({
      code, tokenHash: "x", departureId: d!.id, status: "confirmed" as const, holdExpiresAt: at(1), name: "A", email: "a@example.com", phone: "0900000000", locale: "vi",
      adults: 2, seats: 2, unitPriceVnd: 1_000_000, totalVnd: 2_000_000, depositVnd: 600_000, ...extra,
    });
    const rows = await db
      .insert(bookings)
      .values([
        // VNPay deposit of 1M (more than the 600k deposit): the old code kept only "deposit paid".
        b("BV-BKFA22", { status: "deposit_paid", depositPaidAt: at(2) }),
        // Deposit by transfer, balance recorded by staff.
        b("BV-BKFB22", { depositPaidAt: at(3), balancePaidAt: at(9) }),
        // Klook entered by staff (old form: amount received = total), not marked paid in full then.
        b("BV-BKFC22", { source: "klook", totalVnd: 1_500_000, depositVnd: 450_000, depositPaidAt: at(4) }),
        // Late deposit, given back.
        b("BV-BKFD22", { status: "cancelled", refundDueVnd: 600_000, refundedVnd: 600_000, refundedAt: at(7) }),
      ])
      .returning({ id: bookings.id, code: bookings.code });
    const id = (code: string) => rows.find((r) => r.code === code)!.id;
    await db.insert(bookingPayments).values([
      { bookingId: id("BV-BKFA22"), method: "vnpay", purpose: "deposit", txnRef: "A1", amountVnd: 1_000_000, status: "paid", paidAt: at(2) },
      { bookingId: id("BV-BKFA22"), method: "vnpay", purpose: "deposit", txnRef: "A0", amountVnd: 600_000, status: "failed" },
      { bookingId: id("BV-BKFB22"), method: "transfer", purpose: "deposit", txnRef: "B1", amountVnd: 600_000, status: "paid", paidAt: at(3) },
      { bookingId: id("BV-BKFD22"), method: "vnpay", purpose: "deposit", txnRef: "D1", amountVnd: 600_000, status: "paid", paidAt: at(6) },
    ]);

    for (const statement of backfill) await db.execute(sql.raw(statement));

    const ledger = await db.select().from(bookingLedger);
    const of = (code: string) => ledger.filter((l) => l.bookingId === id(code)).map((l) => [l.kind, l.channel, l.amountVnd]).sort();
    expect(of("BV-BKFA22")).toEqual([["in", "vnpay", 1_000_000]]);
    expect(of("BV-BKFB22")).toEqual([["in", "staff", 1_400_000], ["in", "transfer", 600_000]]);
    expect(of("BV-BKFC22")).toEqual([["in", "ota", 1_500_000]]);
    expect(of("BV-BKFD22")).toEqual([["in", "vnpay", 600_000], ["refund", "staff", 600_000]]);
    expect(ledger.every((l) => l.note === "backfill")).toBe(true);

    const booking = async (code: string) => (await db.select().from(bookings).where(eq(bookings.code, code)))[0]!;
    expect(owedVnd(await booking("BV-BKFA22"))).toBe(1_000_000);
    expect(owedVnd(await booking("BV-BKFB22"))).toBe(0);
    expect(await booking("BV-BKFC22")).toMatchObject({ receivedVnd: 1_500_000, balancePaidAt: at(4) });
    expect(await booking("BV-BKFD22")).toMatchObject({ receivedVnd: 600_000, refundDueVnd: 600_000 });
  });
});
