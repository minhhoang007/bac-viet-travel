import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { BASE_URL, testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { bookings, departures, discountCodes } from "../../schema/booking";
import { staffRoles } from "../../schema/staff";
import { createDashboard } from "../../booking/dashboard";
import { createReports } from "../../booking/reports";
import { createDemoReset } from "../reset";
import { DEMO_STAFF } from "../staff";

const { db, close } = testDb();
let clock = new Date("2026-10-14T03:00:00Z"); // 10:00 in Vietnam
const tours = async () => [
  { slug: "ha-long-cruise-2d1n", priceVnd: 3_200_000 },
  { slug: "ninh-binh-day-tour", priceVnd: 1_190_000 },
  { slug: "sapa-trekking-2d1n", priceVnd: 2_490_000 },
];
// The product reads the flag from the process env (getPublicEnv), the container from the validated env: set both.
process.env.DEMO_MODE = "true";
const t = testApp(db, { modules: { admin: true, jobs: true }, env: { DEMO_MODE: "true" }, overrides: { now: () => clock } });
const demo = createDemoReset({ db, logger: t.container.logger, tours, now: () => clock });

beforeEach(async () => {
  clock = new Date("2026-10-14T03:00:00Z");
  await resetDb(db);
  await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes, staff_roles, site_settings RESTART IDENTITY CASCADE`);
});
afterAll(() => close());

describe("demo reset", () => {
  it("replaces visitors' bookings with the sample: every status, departures ahead, a short date, codes, demo staff", async () => {
    // Something a visitor left behind.
    const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-20", capacity: 5 }).returning();
    await db.insert(bookings).values({ code: "BV-VISIT1", tokenHash: "x", departureId: d!.id, status: "held", holdExpiresAt: clock, name: "Visitor", email: "v@example.com", phone: "0900000000", locale: "vi", adults: 1, seats: 1, unitPriceVnd: 1, totalVnd: 1, depositVnd: 1 });
    await t.container.mail.send({ kind: "contact", to: "team@example.com", subject: "Hi", text: "Hi" });

    await demo.reset();

    const rows = await db.select().from(bookings);
    expect(rows.find((b) => b.code === "BV-VISIT1")).toBeUndefined();
    expect(new Set(rows.map((b) => b.status))).toEqual(new Set(["held", "deposit_paid", "confirmed", "cancelled", "expired"]));
    expect(rows.some((b) => b.refundDueVnd > b.refundedVnd)).toBe(true); // a refund to make
    expect(rows.some((b) => b.source === "klook" && !b.guestEmails)).toBe(true);
    const deps = await db.select().from(departures);
    expect(deps.filter((x) => x.date > "2026-10-14").length).toBeGreaterThan(20);
    expect(deps.some((x) => x.date < "2026-10-14")).toBe(true); // a finished trip for reports
    expect((await db.select().from(discountCodes)).map((c) => c.code).sort()).toEqual(["CHAODEMO", "HE2026"]);
    expect(await t.container.demoMailbox!.list()).toEqual([]);

    // The admin has something in every queue and figure.
    const dashboard = await createDashboard({ db, now: () => clock }).data();
    expect(dashboard.queue).toMatchObject({ transfers: 1, toConfirm: 2, refunds: 1 });
    expect(dashboard.queue.lowFill).toBeGreaterThanOrEqual(1);
    // History: a running business, not a handful of rows.
    expect(rows.length).toBeGreaterThan(60);
    expect(dashboard.bookings7d.count).toBeGreaterThan(3);
    expect(dashboard.daily.filter((d) => d.vnd > 0).length).toBeGreaterThan(10);
    expect(dashboard.booked.thisMonth).toBeGreaterThan(0);
    // The latest bookings are the sample (made just now), not history; no date has more guests than seats.
    expect(new Set(dashboard.recent.map((r) => r.status))).toContain("held");
    expect(rows.filter((r) => r.depositPaidAt && r.createdAt > r.depositPaidAt)).toEqual([]);
    const taken = new Map<string, number>();
    for (const r of rows) if (r.status !== "cancelled" && r.status !== "expired") taken.set(r.departureId, (taken.get(r.departureId) ?? 0) + r.seats);
    for (const x of deps) expect(taken.get(x.id) ?? 0).toBeLessThanOrEqual(x.capacity);
    expect((await createReports({ db }).cash("2026-10-01", "2026-10-31")).collectedVnd).toBeGreaterThan(0);

    // Demo staff are editors with their staff role, and sign in from /demo.
    for (const s of DEMO_STAFF) {
      const [u] = await db.select().from(users).where(eq(users.email, s.email));
      expect(u).toMatchObject({ role: "editor", status: "active" });
      expect((await db.select().from(staffRoles).where(eq(staffRoles.userId, u!.id)))[0]?.role).toBe(s.role);
      expect(await t.app.auth.demoSignIn(s.email, "/vi/admin/bookings", new Headers({ origin: BASE_URL }))).toMatch(/magic-link\/verify/);
    }
  });

  it("runs once per Vietnam day; an admin demoted by a visitor or a changed staff role comes back", async () => {
    expect(await demo.resetIfDue()).toBe(true);
    expect(await demo.resetIfDue()).toBe(false);
    await db.update(users).set({ role: "admin" }).where(eq(users.email, DEMO_STAFF[0]!.email));

    clock = new Date("2026-10-14T17:30:00Z"); // 00:30 next day in Vietnam
    expect(await demo.resetIfDue()).toBe(true);
    expect((await db.select().from(users).where(eq(users.email, DEMO_STAFF[0]!.email)))[0]?.role).toBe("editor");
  });

  it("runs from the jobs tick on a demo site (published tours from the catalog)", async () => {
    await t.container.jobs!.tick();
    expect((await db.select().from(bookings)).length).toBeGreaterThan(5);
  });
});
