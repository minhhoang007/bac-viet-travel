import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import type { MailMessage } from "@/core/ports/mail";
import { testDb } from "@/tests/integration/setup/db";
import { bookings, departures } from "../../schema/booking";
import { createFeedbackService } from "../feedback";

const { db, close } = testDb();
let clock = new Date("2026-11-10T03:00:00Z");
let sent: MailMessage[] = [];
const feedback = createFeedbackService({
  db,
  logger: createLogger({ write: () => {} }),
  mail: { send: async (m) => void sent.push(m) },
  secret: () => "test-secret-0123456789abcdef0123456789",
  siteUrl: () => "https://bacviet.example",
  tourTitle: async () => "Sapa 2 ngày",
  now: () => clock,
});

async function booking(code: string, date: string, values: Partial<typeof bookings.$inferInsert> = {}) {
  const [d] = await db.insert(departures).values({ tourSlug: "sapa-trekking-2d1n", date, capacity: 10 }).returning();
  await db.insert(bookings).values({
    code, tokenHash: "x", departureId: d!.id, status: "confirmed", holdExpiresAt: clock, name: "Lan", email: "lan@example.com", phone: "0900000000", locale: "vi",
    adults: 1, seats: 1, unitPriceVnd: 1_000_000, totalVnd: 1_000_000, depositVnd: 300_000, ...values,
  });
}

beforeEach(async () => {
  clock = new Date("2026-11-10T03:00:00Z");
  sent = [];
  await db.execute(sql`TRUNCATE trip_feedback, booking_payments, bookings, departures RESTART IDENTITY CASCADE`);
});
afterAll(() => close());

describe("post-trip feedback (E4)", () => {
  it("emails a signed link once, 3+ days after departure, only for paid trips with guest emails, within 30 days", async () => {
    await booking("BV-FBAA22", "2026-11-06"); // ended: yes
    await booking("BV-FBBB22", "2026-11-08"); // too recent
    await booking("BV-FBCC22", "2026-09-01"); // too old
    await booking("BV-FBDD22", "2026-11-05", { status: "cancelled" });
    await booking("BV-FBEE22", "2026-11-04", { guestEmails: false });
    expect(await feedback.sendRequests()).toBe(1);
    expect(sent.map((m) => [m.kind, m.to])).toEqual([["booking_feedback", "lan@example.com"]]);
    expect(sent[0]!.text).toContain(feedback.link("BV-FBAA22", "vi"));
    expect(await feedback.sendRequests()).toBe(0); // once
  });

  it("the guest rates once with the signed link; a wrong signature or rating is refused", async () => {
    await booking("BV-FBAA22", "2026-11-06");
    const s = new URL(feedback.link("BV-FBAA22", "vi")).searchParams.get("s")!;
    expect(await feedback.find("BV-FBAA22", "x".repeat(32))).toBeNull();
    expect(await feedback.submit("BV-FBAA22", s, { rating: "7" })).toEqual({ status: "invalid", field: "rating" });
    expect(await feedback.submit("BV-FBAA22", s, { rating: "5", comment: " Hướng dẫn viên rất nhiệt tình " })).toEqual({ status: "saved", rating: 5 });
    expect(await feedback.submit("BV-FBAA22", s, { rating: "1" })).toEqual({ status: "already" });
    const [b] = await db.select().from(bookings).where(eq(bookings.code, "BV-FBAA22"));
    expect(await feedback.forBooking(b!.id)).toMatchObject({ rating: 5, comment: "Hướng dẫn viên rất nhiệt tình" });
  });
});
