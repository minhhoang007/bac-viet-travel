import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import { testDb } from "@/tests/integration/setup/db";
import { bookings, departures, discountCodes } from "../../schema/booking";
import { createBookingService } from "../service";
import { createDiscountAdmin } from "../discounts";

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

describe("traveller details (D7)", () => {
  it("the guest saves one row per person; bad rows are reported by index; wrong token and past cutoff refused", async () => {
    const d = await departure();
    const held = await service().hold(guest(d.id, { adults: "2", children: "0", infants: "1" }), "ip");
    if (held.status !== "held") throw new Error(held.status);

    expect(await service().saveTravellers(held.code, held.token, { name_0: "Nguyễn Lan", year_0: "1990", name_1: "x", year_1: "1880", name_2: "Bé Na" })).toEqual({
      status: "invalid",
      errors: { name_1: "required", year_1: "invalid", year_2: "required" },
    });
    expect(await service().saveTravellers(held.code, held.token, { name_0: " Nguyễn  Lan ", year_0: "1990", name_1: "Trần Minh", year_1: "1988", name_2: "Bé Na", year_2: "2025" })).toEqual({ status: "saved" });
    const [b] = await db.select().from(bookings);
    expect(b!.travellers).toEqual([
      { name: "Nguyễn Lan", birthYear: 1990 },
      { name: "Trần Minh", birthYear: 1988 },
      { name: "Bé Na", birthYear: 2025 },
    ]);
    expect((await service().saveTravellers(held.code, "x".repeat(32), {})).status).toBe("not_found");

    // Inside the 2-day cutoff before departure (and paid): locked.
    await db.update(bookings).set({ status: "deposit_paid" });
    clock = new Date("2026-10-09T03:00:00Z");
    expect((await service().saveTravellers(held.code, held.token, { name_0: "A B", year_0: "1990" })).status).toBe("locked");
  });
});

describe("discount codes (D6)", () => {
  const code = (values: Partial<typeof discountCodes.$inferInsert> = {}) =>
    db.insert(discountCodes).values({ code: "TET2027", kind: "percent", value: 10, validFrom: "2026-09-01", validTo: "2026-12-31", ...values });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE discount_codes RESTART IDENTITY CASCADE`);
  });

  it("takes the discount off the total before the deposit; the code is stored; case and spaces do not matter", async () => {
    await code();
    const d = await departure();
    const result = await service().hold(guest(d.id, { adults: "2", discountCode: " tet2027 " }), "ip");
    expect(result.status).toBe("held");
    const [b] = await db.select().from(bookings);
    // 2 × 2,000,000 = 4,000,000 − 10% = 3,600,000; deposit 30% = 1,080,000
    expect(b).toMatchObject({ discountCode: "TET2027", discountVnd: 400_000, totalVnd: 3_600_000, depositVnd: 1_080_000 });
    expect(await service().checkDiscount("tet2027", "ha-long-cruise-2d1n", 4_000_000)).toEqual({ code: "TET2027", kind: "percent", value: 10 });
  });

  it("refuses unknown, inactive, expired, other-tour, too-small and used-up codes (nothing held)", async () => {
    await code({ code: "OFF", active: false });
    await code({ code: "OLD", validTo: "2026-09-30" });
    await code({ code: "SAPA", tourSlug: "sapa-trekking-2d1n" });
    await code({ code: "BIG", kind: "amount", value: 500_000, minTotalVnd: 5_000_000 });
    await code({ code: "ONCE", maxUses: 1 });
    const d = await departure({ capacity: 10 });
    for (const c of ["NOPE", "OFF", "OLD", "SAPA", "BIG"]) {
      expect(await service().hold(guest(d.id, { discountCode: c }), "ip"), c).toEqual({ status: "invalid", fieldErrors: { discountCode: "invalid" } });
    }
    expect((await service().hold(guest(d.id, { discountCode: "ONCE" }), "ip")).status).toBe("held");
    expect(await service().hold(guest(d.id, { discountCode: "ONCE" }), "ip")).toEqual({ status: "invalid", fieldErrors: { discountCode: "invalid" } });
    // The first hold expires: the use comes back.
    clock = new Date(clock.getTime() + 20 * 60_000);
    expect((await service().hold(guest(d.id, { discountCode: "ONCE" }), "ip")).status).toBe("held");
  });

  it("an amount code takes at most 90% off (a deposit is still paid)", async () => {
    await code({ code: "HUGE", kind: "amount", value: 9_000_000 });
    const d = await departure();
    await service().hold(guest(d.id, { discountCode: "HUGE" }), "ip");
    const [b] = await db.select().from(bookings);
    expect(b).toMatchObject({ discountVnd: 1_800_000, totalVnd: 200_000, depositVnd: 60_000 });
  });
});

describe("discount admin (D6)", () => {
  it("lists live uses per code (held, paid, confirmed), not other bookings", async () => {
    await db.execute(sql`TRUNCATE discount_codes RESTART IDENTITY CASCADE`);
    await db.insert(discountCodes).values({ code: "LIST10", kind: "percent", value: 10, validFrom: "2026-09-01", validTo: "2026-12-31" });
    const d = await departure({ capacity: 10 });
    await service().hold(guest(d.id, { discountCode: "LIST10" }), "ip");
    await service().hold(guest(d.id), "ip");
    const admin = createDiscountAdmin({ db, now: () => clock });
    expect((await admin.list()).map((r) => [r.code, r.used])).toEqual([["LIST10", 1]]);
  });
});

describe("add-ons (B6)", () => {
  it("adds chosen add-ons to the total and stores them with names and line prices", async () => {
    const withAddons = createBookingService({
      db,
      logger,
      rateLimiter: createMemoryRateLimiter({ max: 1_000, windowMs: 60_000 }),
      tourPrice: async () => 2_000_000,
      tourAddons: async () => [{ id: "pickup", name: { vi: "Đón khách sạn", en: "Hotel pick-up" }, vnd: 200_000, per: "booking" }],
      now: () => clock,
    });
    const d = await departure();
    expect((await withAddons.hold(guest(d.id, { adults: "2", addon_pickup: "1", addon_unknown: "5" }), "ip")).status).toBe("held");
    const [b] = await db.select().from(bookings);
    expect(b).toMatchObject({ totalVnd: 4_200_000, addons: [{ id: "pickup", name: { vi: "Đón khách sạn", en: "Hotel pick-up" }, qty: 1, vnd: 200_000 }] });
  });
});
