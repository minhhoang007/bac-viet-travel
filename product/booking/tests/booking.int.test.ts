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

const service = (max = 1_000) =>
  createBookingService({
    db,
    logger,
    rateLimiter: createMemoryRateLimiter({ max, windowMs: 60_000 }),
    tourPrice: (slug) => (slug === "ha-long-cruise-2d1n" ? 2_000_000 : null),
    now: () => clock,
  });

const guest = (departureId: string, extra: Record<string, unknown> = {}) => ({
  departureId,
  name: "Nguyễn Lan",
  email: "lan@example.com",
  phone: "0912345678",
  adults: "1",
  locale: "vi",
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
});
