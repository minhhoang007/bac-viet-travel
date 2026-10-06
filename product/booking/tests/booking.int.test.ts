import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import { testDb } from "@/tests/integration/setup/db";
import { bookings, departures } from "../../schema/booking";
import { createBookingService } from "../service";

const { db, close } = testDb();
const logger = createLogger({ write: () => {} });
let clock = new Date("2026-10-01T03:00:00Z");

const PRIVATE = { maxGuests: 10, tiers: [{ minGuests: 2, vnd: 3_000_000, usd: 120 }, { minGuests: 4, vnd: 2_500_000, usd: 100 }] };

const service = (max = 1_000) =>
  createBookingService({
    db,
    logger,
    rateLimiter: createMemoryRateLimiter({ max, windowMs: 60_000 }),
    tourPrice: async (slug) => (slug === "ha-long-cruise-2d1n" ? 2_000_000 : null),
    tourPrivate: async (slug) => (slug === "ha-long-cruise-2d1n" ? PRIVATE : null),
    now: () => clock,
  });

const guest = (departureId: string, extra: Record<string, unknown> = {}) => ({
  departureId,
  name: "Nguyễn Lan",
  email: "lan@example.com",
  phone: "0912345678",
  adults: "1",
  locale: "vi",
  agree: "on",
  ...extra,
});

async function departure(values: Partial<typeof departures.$inferInsert> = {}) {
  const [d] = await db.insert(departures).values({ tourSlug: "ha-long-cruise-2d1n", date: "2026-10-10", capacity: 4, ...values }).returning();
  return d!;
}

beforeEach(async () => {
  clock = new Date("2026-10-01T03:00:00Z");
  await db.execute(sql`TRUNCATE bookings, departures RESTART IDENTITY CASCADE`);
});
afterAll(() => close());

describe("booking holds", () => {
  it("holds seats, prices the party and gives the guest a code + secret link", async () => {
    const d = await departure({ priceVnd: 1_800_000 });
    const result = await service().hold(guest(d.id, { adults: "2", children: "1", infants: "1" }), "ip");
    expect(result.status).toBe("held");
    if (result.status !== "held") return;
    expect(result.code).toMatch(/^BV-[A-Z2-9]{6}$/);

    const view = await service().getForGuest(result.code, result.token);
    expect(view).toMatchObject({ status: "held", seats: 3, unitPriceVnd: 1_800_000, totalVnd: 4_950_000, depositVnd: 1_485_000, isExpired: false });
    expect(view!.holdExpiresAt.getTime() - clock.getTime()).toBe(15 * 60_000);
    const [stored] = await db.select().from(bookings);
    expect(stored!.tokenHash).not.toContain(result.token);
    expect((await service().getDeparture(d.id))!.seatsLeft).toBe(1);
  });

  it("never oversells: 10 guests race for 2 seats, exactly 2 win", async () => {
    const d = await departure({ capacity: 2 });
    const s = service();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => s.hold(guest(d.id), `ip-${i}`)));
    expect(results.filter((r) => r.status === "held")).toHaveLength(2);
    expect(results.filter((r) => r.status === "sold_out")).toHaveLength(8);
    expect((await s.getDeparture(d.id))!).toMatchObject({ seatsLeft: 0, bookable: false });
  });

  it("releases seats when a hold expires, even before any sweep", async () => {
    const d = await departure({ capacity: 2 });
    const first = await service().hold(guest(d.id, { adults: "2" }), "ip");
    expect((await service().hold(guest(d.id), "ip")).status).toBe("sold_out");

    clock = new Date(clock.getTime() + 15 * 60_000 + 1);
    expect((await service().listDepartures("ha-long-cruise-2d1n"))[0]!.seatsLeft).toBe(2);
    if (first.status === "held") expect((await service().getForGuest(first.code, first.token))!.isExpired).toBe(true);
    expect((await service().hold(guest(d.id), "ip")).status).toBe("held");
    expect((await db.select().from(bookings).where(eq(bookings.status, "expired"))).length).toBe(1);
    expect(await service().expireStale()).toBe(0);
  });

  it("refuses closed, past-cutoff and unknown departures; validates input", async () => {
    const closed = await departure({ status: "closed" });
    const tooSoon = await departure({ date: "2026-10-02" });
    expect((await service().hold(guest(closed.id), "ip")).status).toBe("unavailable");
    expect((await service().hold(guest(tooSoon.id), "ip")).status).toBe("unavailable");
    expect((await service().hold(guest("0199a000-0000-7000-8000-000000000000"), "ip")).status).toBe("unavailable");
    expect(await service().hold(guest(closed.id, { email: "bad", adults: "11" }), "ip")).toMatchObject({ status: "invalid", fieldErrors: { email: "invalid", adults: "invalid" } });
    // The terms and cancellation policy must be accepted (checkbox).
    expect(await service().hold(guest(closed.id, { agree: undefined }), "ip")).toMatchObject({ status: "invalid", fieldErrors: { agree: "must_agree" } });
    expect((await service().listDepartures("ha-long-cruise-2d1n")).map((v) => v.bookable)).toEqual([false, false]);
  });

  it("guest lookup: wrong token or code looks the same as missing; honeypot and rate limit stop holds", async () => {
    const d = await departure();
    const held = await service().hold(guest(d.id), "ip");
    if (held.status !== "held") throw new Error("expected a hold");
    expect(await service().getForGuest(held.code, "x".repeat(32))).toBeNull();
    expect(await service().getForGuest("BV-AAAAAA", held.token)).toBeNull();
    expect(await service().getForGuest("nonsense", held.token)).toBeNull();

    expect((await service().hold(guest(d.id, { website: "spam" }), "ip")).status).toBe("rate_limited");
    const limited = service(1);
    await limited.hold(guest(d.id), "same");
    expect((await limited.hold(guest(d.id), "same")).status).toBe("rate_limited");
    expect((await db.select().from(bookings)).length).toBe(2);
  });

  describe("private tours", () => {
    const privateGuest = (extra: Record<string, unknown> = {}) => ({
      tourSlug: "ha-long-cruise-2d1n", date: "2026-10-10", name: "Nguyễn Lan", email: "lan@example.com", phone: "0912345678", adults: "4", locale: "vi", agree: "on", ...extra,
    });

    it("creates its own departure (capacity = group), priced by tier, held like a group booking; never listed", async () => {
      // A group departure on the same day stays untouched (the unique day index only covers group departures).
      const [group] = await db.insert(departures).values({ tourSlug: "ha-long-cruise-2d1n", date: "2026-10-10", capacity: 4 }).returning();
      const held = await service().holdPrivate(privateGuest({ children: "1" }), "ip");
      expect(held.status).toBe("held");
      const [b] = await db.select().from(bookings).where(eq(bookings.code, (held as { code: string }).code));
      expect(b).toMatchObject({ status: "held", seats: 5, unitPriceVnd: 2_500_000, totalVnd: 4 * 2_500_000 + 1_875_000 });
      const [d] = await db.select().from(departures).where(eq(departures.id, b!.departureId));
      expect(d).toMatchObject({ kind: "private", capacity: 5, date: "2026-10-10", priceVnd: 2_500_000 });

      expect((await service().listDepartures("ha-long-cruise-2d1n")).map((x) => x.id)).toEqual([group!.id]);
      expect((await service().getDeparture(group!.id))!.seatsLeft).toBe(4);
      expect(await service().getDeparture(d!.id)).toBeNull();
      // A group hold cannot target a private departure.
      expect((await service().hold(guest(d!.id), "ip")).status).toBe("unavailable");
    });

    it("refuses group sizes outside the tiers, dates inside the cut-off, and tours without private pricing", async () => {
      expect(await service().holdPrivate(privateGuest({ adults: "1" }), "ip")).toMatchObject({ status: "invalid", fieldErrors: { adults: "invalid" } });
      expect(await service().holdPrivate(privateGuest({ adults: "8", children: "3" }), "ip")).toMatchObject({ status: "invalid", fieldErrors: { adults: "too_many" } });
      expect(await service().holdPrivate(privateGuest({ date: "2026-10-02" }), "ip")).toMatchObject({ status: "invalid", fieldErrors: { date: "invalid" } });
      expect(await service().holdPrivate(privateGuest({ agree: undefined }), "ip")).toMatchObject({ status: "invalid", fieldErrors: { agree: "must_agree" } });
      expect((await service().holdPrivate(privateGuest({ tourSlug: "sapa-trekking-2d1n" }), "ip")).status).toBe("unavailable");
      expect(await db.select().from(departures)).toEqual([]);
    });
  });
});

describe("prices by traveller type (B2)", () => {
  const priced = createBookingService({
    db,
    logger,
    rateLimiter: createMemoryRateLimiter({ max: 1_000, windowMs: 60_000 }),
    tourPrice: async (slug) => (slug === "ha-long-cruise-2d1n" ? 2_000_000 : 1_000_000),
    tourPricing: async (slug) => (slug === "ha-long-cruise-2d1n" ? { childPercent: 50, infantVnd: 100_000, singleSupplementVnd: 900_000 } : { childPercent: 75, infantVnd: 0, singleSupplementVnd: 0 }),
    now: () => clock,
  });

  it("charges the tour's child, infant and single room prices and stores the single rooms", async () => {
    const d = await departure();
    const result = await priced.hold(guest(d.id, { adults: "2", children: "1", infants: "1", singleRooms: "1" }), "ip");
    expect(result.status).toBe("held");
    const [b] = await db.select().from(bookings);
    // 2 × 2,000,000 + 1,000,000 + 100,000 + 900,000
    expect(b).toMatchObject({ seats: 3, singleRooms: 1, totalVnd: 6_000_000, depositVnd: 1_800_000 });
  });

  it("refuses single rooms on a tour without a supplement, and more rooms than travellers", async () => {
    const d = await departure({ tourSlug: "ninh-binh-day-tour" });
    expect(await priced.hold(guest(d.id, { singleRooms: "1" }), "ip")).toEqual({ status: "invalid", fieldErrors: { singleRooms: "invalid" } });
    const cruise = await departure({ date: "2026-10-11" });
    expect(await priced.hold(guest(cruise.id, { adults: "1", singleRooms: "2" }), "ip")).toEqual({ status: "invalid", fieldErrors: { singleRooms: "too_many" } });
    expect(await db.select().from(bookings)).toHaveLength(0);
  });
});
