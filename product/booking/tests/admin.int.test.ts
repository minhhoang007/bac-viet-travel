import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { bookings, departures } from "../../schema/booking";
import { createReports } from "../reports";

// The real product services as bootstrap builds them (admin + jobs on), with a recording mail port.
const { db, close } = testDb();
let clock = new Date("2026-10-01T03:00:00Z");
const { container, sent } = testApp(db, { modules: { admin: true, jobs: true }, overrides: { now: () => clock } });
const clearMail = () => void sent.splice(0);
const { booking, bookingAdmin } = container.app!.product;

let staff: { id: string; email: string };

async function paidBooking(capacity = 10, date = "2026-10-10", seats = 2) {
  let [d] = await db.select().from(departures).where(eq(departures.date, date));
  d ??= (await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date, capacity }).returning())[0]!;
  const held = await booking.hold({ departureId: d.id, name: "Lan", email: "lan@example.com", phone: "0912345678", adults: String(seats), locale: "vi", agree: "on" }, `ip-${Math.random()}`);
  if (held.status !== "held") throw new Error(held.status);
  await db.update(bookings).set({ status: "deposit_paid", depositPaidAt: clock }).where(eq(bookings.code, held.code));
  return { code: held.code, departure: d };
}
const row = async (code: string) => (await db.select().from(bookings).where(eq(bookings.code, code)))[0]!;

beforeEach(async () => {
  clock = new Date("2026-10-01T03:00:00Z");
  clearMail();
  await resetDb(db);
  await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
  const [u] = await db.insert(users).values({ email: "staff@example.com", role: "admin" }).returning();
  staff = { id: u!.id, email: u!.email };
});
afterAll(() => close());

describe("booking admin", () => {
  it("confirm: only a paid booking, emails the guest, audited; a second confirm changes nothing", async () => {
    const { code } = await paidBooking();
    expect(await bookingAdmin.confirm(staff, code)).toBe(true);
    expect(await row(code)).toMatchObject({ status: "confirmed" });
    expect(sent.map((m) => [m.kind, m.to])).toEqual([["booking_confirmed", "lan@example.com"]]);
    expect(await bookingAdmin.confirm(staff, code)).toBe(false);
    const { rows } = await container.admin!.listAudit({ targetId: code });
    expect(rows.map((r) => [r.action, r.actorEmail])).toEqual([["booking.confirm", "staff@example.com"]]);
  });

  it("cancel with refund: seats released, refund owed, guest told; then marked refunded", async () => {
    const { code, departure } = await paidBooking(4, "2026-10-10", 3);
    expect((await booking.getDeparture(departure.id))!.seatsLeft).toBe(1);
    await expect(bookingAdmin.cancel(staff, code, { reason: " ", refund: true })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(await bookingAdmin.cancel(staff, code, { reason: "Bão, tàu không chạy", refund: true })).toBe(true);
    const cancelled = await row(code);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelReason: "Bão, tàu không chạy", refundDueVnd: cancelled.depositVnd });
    expect((await booking.getDeparture(departure.id))!.seatsLeft).toBe(4);
    expect(sent[0]).toMatchObject({ kind: "booking_cancelled" });
    expect(sent[0]!.text).toContain("hoàn lại");
    expect((await bookingAdmin.list({ filter: "attention" })).rows.map((r) => r.code)).toEqual([code]);

    expect(await bookingAdmin.markRefunded(staff, code, { note: "VNPay refund 123" })).toBe(true);
    expect(await row(code)).toMatchObject({ refundNote: "VNPay refund 123" });
    expect(await bookingAdmin.markRefunded(staff, code, { note: "again" })).toBe(false);
    expect((await bookingAdmin.list({ filter: "attention" })).total).toBe(0);
    expect(await bookingAdmin.confirm(staff, code)).toBe(false); // cancelled stays cancelled
  });

  it("a late deposit (refund_due) ends as cancelled once refunded", async () => {
    const { code } = await paidBooking();
    await db.update(bookings).set({ status: "refund_due", refundDueVnd: 600_000 }).where(eq(bookings.code, code));
    expect(await bookingAdmin.markRefunded(staff, code, { note: "done" })).toBe(true);
    expect((await row(code)).status).toBe("cancelled");
  });

  it("list: filters by status, tour, dates and search", async () => {
    const a = await paidBooking(10, "2026-10-10");
    const b = await paidBooking(10, "2026-10-20");
    await bookingAdmin.confirm(staff, b.code);
    expect((await bookingAdmin.list({ filter: "confirmed" })).rows.map((r) => r.code)).toEqual([b.code]);
    expect((await bookingAdmin.list({ filter: "all", to: "2026-10-15" })).rows.map((r) => r.code)).toEqual([a.code]);
    expect((await bookingAdmin.list({ filter: "all", query: a.code.slice(3) })).rows.map((r) => r.code)).toEqual([a.code]);
    expect((await bookingAdmin.list({ filter: "all", query: "%" })).total).toBe(0); // LIKE wildcards are escaped
    expect((await bookingAdmin.list({ filter: "all", tourSlug: "sapa-trekking-2d1n" })).total).toBe(0);
  });

  it("departures: add weekly dates (skips duplicates and past days), never reduce capacity below seats taken", async () => {
    expect(await bookingAdmin.addDepartures(staff, { tourSlug: "sapa-trekking-2d1n", dates: ["2026-09-30", "2026-10-09", "2026-10-16", "2026-10-16"], capacity: 12, priceVnd: null })).toBe(2);
    expect(await bookingAdmin.addDepartures(staff, { tourSlug: "sapa-trekking-2d1n", dates: ["2026-10-09"], capacity: 12, priceVnd: null }).catch((e) => e.code)).toBe(0);
    await expect(bookingAdmin.addDepartures(staff, { tourSlug: "nope", dates: ["2026-10-09"], capacity: 12, priceVnd: null })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const { departure } = await paidBooking(10, "2026-10-10", 4);
    await expect(bookingAdmin.updateDeparture(staff, departure.id, { capacity: 3 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await bookingAdmin.updateDeparture(staff, departure.id, { capacity: 4, priceVnd: 900_000, status: "closed" })).toBe(true);
    const [d] = await bookingAdmin.listDepartures({ tourSlug: "ninh-binh-day-tour", from: "2026-10-01", to: "2026-10-31" });
    expect(d).toMatchObject({ capacity: 4, priceVnd: 900_000, status: "closed", sold: 4, held: 0 });
    expect((await container.admin!.listAudit({ targetId: departure.id })).rows[0]!.action).toBe("departure.update");
  });

  it("reminders: 3 days before departure, once per booking, only paid/confirmed; registered as a periodic job", async () => {
    const soon = await paidBooking(10, "2026-10-04");
    await paidBooking(10, "2026-10-10"); // too far
    const cancelled = await paidBooking(10, "2026-10-03");
    await bookingAdmin.cancel(staff, cancelled.code, { reason: "x", refund: false });
    clearMail();

    await container.jobs!.tick(); // runs product.booking.reminders
    expect(sent.map((m) => [m.kind, m.to])).toEqual([["booking_reminder", "lan@example.com"]]);
    expect((await row(soon.code)).reminderSentAt).not.toBeNull();
    expect(await bookingAdmin.sendReminders()).toBe(0);
  });

  describe("manual / OTA bookings", () => {
    const klook = (departureId: string, extra: Record<string, unknown> = {}) => ({
      departureId, name: "John Smith", email: "", phone: "", adults: "2", source: "klook", externalRef: "KL-123456", amountVnd: "1500000", status: "confirmed", locale: "en", ...extra,
    });

    it("takes seats under the same lock as the website, no guest emails, audited; never oversells", async () => {
      const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-10", capacity: 4 }).returning();
      const created = await bookingAdmin.createManual(staff, klook(d!.id));
      expect(created.status).toBe("created");
      const code = (created as { code: string }).code;
      expect(await row(code)).toMatchObject({ status: "confirmed", source: "klook", externalRef: "KL-123456", guestEmails: false, seats: 2, totalVnd: 1_500_000 });
      expect((await booking.getDeparture(d!.id))!.seatsLeft).toBe(2);

      // Website hold for 2 takes the rest; the OTA cannot add one more.
      const held = await booking.hold({ departureId: d!.id, name: "Lan", email: "lan@example.com", phone: "0912345678", adults: "2", locale: "vi", agree: "on" }, "ip");
      expect(held.status).toBe("held");
      expect(await bookingAdmin.createManual(staff, klook(d!.id, { adults: "1" }))).toEqual({ status: "sold_out", seatsLeft: 0 });

      // OTA bookings: confirm/cancel/reminder send nothing to the guest.
      expect(await bookingAdmin.cancel(staff, code, { reason: "Khách huỷ trên Klook", refund: false })).toBe(true);
      expect(sent).toEqual([]);
      const { rows } = await container.admin!.listAudit({ targetId: code });
      expect(rows.map((r) => r.action)).toEqual(["booking.cancel", "booking.create_manual"]);
      expect((await bookingAdmin.list({ filter: "all", source: "klook" })).rows.map((r) => r.code)).toEqual([code]);
      expect((await bookingAdmin.list({ filter: "all", source: "website" })).rows).toHaveLength(1);
    });

    it("validates input; guest emails need an address; closed or past dates are refused", async () => {
      const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-10", capacity: 10 }).returning();
      expect(await bookingAdmin.createManual(staff, klook(d!.id, { name: "", source: "website", amountVnd: "-1" }))).toMatchObject({
        status: "invalid",
        fieldErrors: { name: "required", source: "invalid", amountVnd: "invalid" },
      });
      expect(await bookingAdmin.createManual(staff, klook(d!.id, { guestEmails: "on" }))).toMatchObject({ status: "invalid", fieldErrors: { email: "required" } });

      const withEmail = await bookingAdmin.createManual(staff, klook(d!.id, { source: "phone", email: "guest@example.com", guestEmails: "on", status: "deposit_paid" }));
      expect(await row((withEmail as { code: string }).code)).toMatchObject({ status: "deposit_paid", guestEmails: true, email: "guest@example.com" });

      const [past] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-09-30", capacity: 10 }).returning();
      const [closed] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-12", capacity: 10, status: "closed" }).returning();
      expect(await bookingAdmin.createManual(staff, klook(past!.id))).toEqual({ status: "unavailable" });
      expect(await bookingAdmin.createManual(staff, klook(closed!.id))).toEqual({ status: "unavailable" });
    });
  });

  it("stats: deposits this week and what needs action", async () => {
    await paidBooking();
    await paidBooking();
    const s = await bookingAdmin.stats();
    expect(s).toMatchObject({ paidToday: 2, paidWeek: 2, attention: 2 });
    expect(s.depositsWeekVnd).toBeGreaterThan(0);
    expect(s.upcoming).toEqual([]);
  });

  it("admin overview: booking figures linking to the lists", async () => {
    await paidBooking();
    const figures = await container.app!.adminOverview!("vi");
    expect(figures[0]).toEqual({ label: "Cần xử lý", value: 1, href: "/admin/bookings?filter=attention" });
    expect(figures.map((f) => f.href)).toEqual(["/admin/bookings?filter=attention", "/admin/bookings?filter=all", "/admin/reports", "/admin/departures"]);
  });

  describe("change date", () => {
    const departure = async (date: string, values: Partial<typeof departures.$inferInsert> = {}) =>
      (await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date, capacity: 10, ...values }).returning())[0]!;

    it("moves a paid booking to a same-price date: seats follow, money unchanged, reminder reset, guest emailed, audited", async () => {
      const { code, departure: from } = await paidBooking(10, "2026-10-10", 3);
      const to = await departure("2026-10-17");
      await db.update(bookings).set({ reminderSentAt: clock }).where(eq(bookings.code, code));
      const before = await row(code);
      clearMail();

      expect(await bookingAdmin.changeDate(staff, code, to.id)).toEqual({ status: "done" });
      const after = await row(code);
      expect(after).toMatchObject({ departureId: to.id, status: "deposit_paid", totalVnd: before.totalVnd, depositVnd: before.depositVnd, seats: 3, reminderSentAt: null });
      expect((await booking.getDeparture(from.id))!.seatsLeft).toBe(10);
      expect((await booking.getDeparture(to.id))!.seatsLeft).toBe(7);
      expect(sent.map((m) => [m.kind, m.to])).toEqual([["booking_date_changed", "lan@example.com"]]);
      expect(sent[0]!.text).toContain("17/10/2026");
      const { rows } = await container.admin!.listAudit({ targetId: code });
      expect(rows.map((r) => r.action)).toEqual(["booking.change_date"]);
    });

    it("two moves racing for the last seats: exactly one wins", async () => {
      const a = await paidBooking(10, "2026-10-10", 2);
      const b = await paidBooking(10, "2026-10-10", 2);
      const to = await departure("2026-10-18", { capacity: 3 });
      const results = await Promise.all([bookingAdmin.changeDate(staff, a.code, to.id), bookingAdmin.changeDate(staff, b.code, to.id)]);
      expect(results.map((r) => r.status).sort()).toEqual(["done", "sold_out"]);
      expect((await booking.getDeparture(to.id))!.seatsLeft).toBe(1);
    });

    it("refuses another price, too few seats, a closed or past date, another tour, and unpaid bookings; options say why", async () => {
      const { code } = await paidBooking(10, "2026-10-10", 3);
      const pricier = await departure("2026-10-11", { priceVnd: 9_990_000 });
      const full = await departure("2026-10-12", { capacity: 2 });
      const closed = await departure("2026-10-13", { status: "closed" });
      const past = await departure("2026-09-20");
      const otherTour = await departure("2026-10-14", { tourSlug: "sapa-trekking-2d1n" });
      const ok = await departure("2026-10-15");

      const options = await bookingAdmin.dateOptions(code);
      expect(options.map((o) => [o.date, o.samePrice])).toEqual([["2026-10-11", false], ["2026-10-15", true]]);

      expect(await bookingAdmin.changeDate(staff, code, pricier.id)).toEqual({ status: "price_differs" });
      expect(await bookingAdmin.changeDate(staff, code, full.id)).toEqual({ status: "sold_out", seatsLeft: 2 });
      expect(await bookingAdmin.changeDate(staff, code, closed.id)).toEqual({ status: "unavailable" });
      expect(await bookingAdmin.changeDate(staff, code, past.id)).toEqual({ status: "unavailable" });
      expect(await bookingAdmin.changeDate(staff, code, otherTour.id)).toEqual({ status: "unavailable" });
      expect(await bookingAdmin.changeDate(staff, code, "not-a-uuid")).toEqual({ status: "unavailable" });
      expect((await row(code)).departureId).not.toBe(ok.id);
      expect((await container.admin!.listAudit({ targetId: code })).rows).toEqual([]);

      await db.update(bookings).set({ status: "held" }).where(eq(bookings.code, code));
      expect(await bookingAdmin.changeDate(staff, code, ok.id)).toEqual({ status: "not_allowed" });
      expect(await bookingAdmin.dateOptions(code)).toEqual([]);
    });
  });

  it("contact: fixes name, email and phone; audits field names only; never empties the email of a guest who gets emails", async () => {
    const { code } = await paidBooking();
    const before = await row(code);
    expect(await bookingAdmin.updateContact(staff, code, { name: "Nguyễn Lan", email: "lan.nguyen@example.com", phone: before.phone })).toBe(true);
    expect(await row(code)).toMatchObject({ name: "Nguyễn Lan", email: "lan.nguyen@example.com", seats: before.seats, totalVnd: before.totalVnd, status: "deposit_paid" });
    const { rows } = await container.admin!.listAudit({ targetId: code });
    expect(rows.map((r) => [r.action, r.metadata])).toEqual([["booking.contact", { changed: ["name", "email"] }]]);

    expect(await bookingAdmin.updateContact(staff, code, { name: "Nguyễn Lan", email: "", phone: "" })).toBe(false);
    expect(await bookingAdmin.updateContact(staff, code, { name: "L", email: "lan@example.com" })).toBe(false);
    expect(await bookingAdmin.updateContact(staff, "BV-ZZZZZZ", { name: "Lan Anh", email: "a@example.com" })).toBe(false);
    expect((await row(code)).email).toBe("lan.nguyen@example.com");
  });

  it("discount edit: dates, value and limits change, the code does not; invalid input rejected; audited", async () => {
    const { discounts } = container.app!.product;
    const raw = { code: "TET2027", kind: "percent", value: "10", validFrom: "2026-10-01", validTo: "2026-10-31", tourSlug: "", minTotalVnd: "", maxUses: "5", note: "" };
    expect(await discounts.create(staff, raw)).toEqual({ status: "created" });
    const [code] = await discounts.list();
    expect(await discounts.update(staff, code!.id, { ...raw, code: "OTHER", value: "15", validTo: "2026-12-31", maxUses: "" })).toEqual({ status: "updated" });
    expect((await discounts.list())[0]).toMatchObject({ code: "TET2027", value: 15, validTo: "2026-12-31", maxUses: null });
    expect(await discounts.update(staff, code!.id, { ...raw, value: "95" })).toMatchObject({ status: "invalid", fieldErrors: { value: "invalid" } });
    expect(await discounts.update(staff, code!.id, { ...raw, validTo: "2026-09-01" })).toMatchObject({ status: "invalid", fieldErrors: { validTo: "invalid" } });
    expect(await discounts.update(staff, "019a0000-0000-7000-8000-000000000000", raw)).toEqual({ status: "not_found" });
    const { rows } = await container.admin!.listAudit({ targetId: code!.id });
    expect(rows.map((r) => r.action)).toEqual(["discount.update"]);
  });
});

describe("reports (H3)", () => {
  it("per tour: departures, capacity, sold seats, revenue and deposits; per source; refunds owed; held and other months left out", async () => {
    await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
    const [a] = await db.insert(departures).values({ tourSlug: "sapa-trekking-2d1n", date: "2026-11-05", capacity: 10 }).returning();
    await db.insert(departures).values({ tourSlug: "sapa-trekking-2d1n", date: "2026-11-12", capacity: 10 });
    const [other] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-12-01", capacity: 10 }).returning();
    const row = (code: string, departureId: string, status: "deposit_paid" | "confirmed" | "held", seats: number, source: "website" | "klook" = "website") => ({
      code, tokenHash: "x", departureId, status, holdExpiresAt: new Date("2030-01-01"), name: "A", email: "a@example.com", phone: "0900000000", locale: "vi",
      adults: seats, seats, unitPriceVnd: 1_000_000, totalVnd: seats * 1_000_000, depositVnd: seats * 300_000, source,
    });
    await db.insert(bookings).values([
      row("BV-RPTA22", a!.id, "deposit_paid", 2),
      row("BV-RPTB22", a!.id, "confirmed", 3, "klook"),
      row("BV-RPTC22", a!.id, "held", 4),
      row("BV-RPTD22", other!.id, "confirmed", 5),
    ]);
    await db.update(bookings).set({ refundDueVnd: 300_000 }).where(eq(bookings.code, "BV-RPTA22"));

    const report = await createReports({ db }).report("2026-11-01", "2026-11-30");
    expect(report.tours).toEqual([{ tourSlug: "sapa-trekking-2d1n", departures: 2, capacity: 20, seats: 5, bookings: 2, revenueVnd: 5_000_000, depositsVnd: 1_500_000 }]);
    expect(report.sources).toEqual([
      { source: "klook", bookings: 1, seats: 3, revenueVnd: 3_000_000 },
      { source: "website", bookings: 1, seats: 2, revenueVnd: 2_000_000 },
    ]);
    expect(report.refundsOwedVnd).toBe(300_000);
  });
});
