import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { bookingPayments, bookings, departures } from "../../schema/booking";
import { createDashboard } from "../dashboard";
import { createBookingAdmin } from "../admin";
import { createLogger } from "@/core/logger";
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

  it("a transfer recorded after the deposit was paid (extra money, owed back) is audited", async () => {
    // The deposit service's own outcomes are covered in deposits.int.test.ts; here only the audit of its answer.
    const admin = createBookingAdmin({
      db, logger: createLogger({ write: () => {} }), mail: { send: async () => {} }, audit: container.admin, tourTitle: async () => "",
      tourExists: async () => true, receiveTransfer: async () => "extra", now: () => clock,
    });
    const code = "BV-EXTRA2";
    expect(await admin.receiveTransfer(staff, code, { amountVnd: 600_000, bankRef: "FT1" })).toBe("extra");
    const { rows } = await container.admin!.listAudit({ targetId: code });
    expect(rows.map((r) => r.action)).toEqual(["booking.transfer_received"]);
  });

  it("a late deposit (refund_due) ends as cancelled once refunded", async () => {
    const { code } = await paidBooking();
    await db.update(bookings).set({ status: "refund_due", refundDueVnd: 600_000 }).where(eq(bookings.code, code));
    expect(await bookingAdmin.markRefunded(staff, code, { note: "done" })).toBe(true);
    expect((await row(code)).status).toBe("cancelled");
  });

  it("a refund owed after an earlier refund: only the new amount is owed, and it is back in the queue", async () => {
    const { code } = await paidBooking();
    // A second transfer (200k) was given back earlier.
    await db.update(bookings).set({ refundDueVnd: 200_000 }).where(eq(bookings.code, code));
    expect(await bookingAdmin.markRefunded(staff, code, { note: "trả 200k chuyển dư" })).toBe(true);
    expect(await row(code)).toMatchObject({ refundDueVnd: 200_000, refundedVnd: 200_000 });

    expect(await bookingAdmin.cancel(staff, code, { reason: "Khách ốm", refund: true })).toBe(true);
    const cancelled = await row(code);
    expect(cancelled.refundDueVnd - cancelled.refundedVnd).toBe(cancelled.depositVnd);
    expect((await bookingAdmin.list({ filter: "attention" })).rows.map((r) => r.code)).toEqual([code]);
    expect(await bookingAdmin.markRefunded(staff, code, { note: "trả cọc" })).toBe(true);
    expect(await row(code)).toMatchObject({ refundedVnd: 200_000 + cancelled.depositVnd });
    expect((await bookingAdmin.list({ filter: "attention" })).total).toBe(0);
  });

  it("list: filters by status, tour, dates and search", async () => {
    const a = await paidBooking(10, "2026-10-10");
    const b = await paidBooking(10, "2026-10-20");
    await bookingAdmin.confirm(staff, b.code);
    expect((await bookingAdmin.list({ filter: "confirmed" })).rows.map((r) => r.code)).toEqual([b.code]);
    expect((await bookingAdmin.list({ filter: "all", to: "2026-10-15" })).rows.map((r) => r.code)).toEqual([a.code]);
    expect((await bookingAdmin.list({ filter: "all", query: a.code.slice(3) })).rows.map((r) => r.code)).toEqual([a.code]);
    // The bank transfer note (code without its dash) and a phone typed with spaces find the booking too.
    expect((await bookingAdmin.list({ filter: "all", query: ` ${a.code.replace("-", "").toLowerCase()} ` })).rows.map((r) => r.code)).toEqual([a.code]);
    const { phone } = (await db.select({ phone: bookings.phone }).from(bookings).where(eq(bookings.code, b.code)))[0]!;
    expect((await bookingAdmin.list({ filter: "all", query: phone.replace(/(\d{4})(\d{3})/, "$1 $2 ") })).rows.map((r) => r.code)).toContain(b.code);
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

    it("sales (no confirm, no money): deposit paid only, and never below half the website price; managers may", async () => {
      const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-10", capacity: 10, priceVnd: 1_000_000 }).returning();
      const sale = { confirm: false, money: false };
      expect(await bookingAdmin.createManual(staff, klook(d!.id), sale)).toEqual({ status: "invalid", fieldErrors: { status: "not_allowed" } });
      // 2 adults on the website: 2,000,000. Half is the floor.
      expect(await bookingAdmin.createManual(staff, klook(d!.id, { status: "deposit_paid", amountVnd: "900000" }), sale)).toEqual({ status: "invalid", fieldErrors: { amountVnd: "amount_low" } });
      expect((await bookingAdmin.createManual(staff, klook(d!.id, { status: "deposit_paid", amountVnd: "1000000" }), sale)).status).toBe("created");
      expect((await bookingAdmin.createManual(staff, klook(d!.id, { amountVnd: "0" }), { confirm: true, money: true })).status).toBe("created");
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

describe("departure minimum and company cancellation", () => {
  it("a minimum of guests is 1…capacity or none, on new and existing dates", async () => {
    expect(await bookingAdmin.addDepartures(staff, { tourSlug: "sapa-trekking-2d1n", dates: ["2026-10-20"], capacity: 12, priceVnd: null, minGuests: 6 })).toBe(1);
    const [d] = await db.select().from(departures).where(eq(departures.date, "2026-10-20"));
    expect(d!.minGuests).toBe(6);
    await expect(bookingAdmin.addDepartures(staff, { tourSlug: "sapa-trekking-2d1n", dates: ["2026-10-21"], capacity: 12, priceVnd: null, minGuests: 13 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(bookingAdmin.updateDeparture(staff, d!.id, { minGuests: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // Fewer seats than the minimum already set is refused too.
    await expect(bookingAdmin.updateDeparture(staff, d!.id, { capacity: 5 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await bookingAdmin.updateDeparture(staff, d!.id, { minGuests: null })).toBe(true);
    expect((await db.select().from(departures).where(eq(departures.id, d!.id)))[0]!.minGuests).toBeNull();
  });

  it("the dashboard counts a departure short of its minimum, even when half full", async () => {
    const { departure } = await paidBooking(4, "2026-10-04", 2); // 2 of 4 seats: not under 50%
    const data = () => createDashboard({ db, now: () => clock }).data();
    expect((await data()).queue.lowFill).toBe(0);
    await db.update(departures).set({ minGuests: 3 }).where(eq(departures.id, departure.id));
    expect((await data()).queue.lowFill).toBe(1);
  });

  it("an empty date counts as short only when it has a minimum", async () => {
    const [d] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-05", capacity: 10 }).returning();
    const data = () => createDashboard({ db, now: () => clock }).data();
    expect((await data()).queue.lowFill).toBe(0);
    await db.update(departures).set({ minGuests: 4 }).where(eq(departures.id, d!.id));
    expect((await data()).queue.lowFill).toBe(1);
  });

  it("a closed date can still be cancelled (and a cancellation run again); a past one cannot", async () => {
    const a = await paidBooking(10, "2026-10-10", 2);
    await db.update(departures).set({ status: "closed" }).where(eq(departures.id, a.departure.id));
    expect(await bookingAdmin.cancelDeparture(staff, a.departure.id, "Bão")).toEqual({ cancelled: 1 });
    expect(await bookingAdmin.cancelDeparture(staff, a.departure.id, "Bão")).toEqual({ cancelled: 0 });

    const past = await paidBooking(10, "2026-10-05", 1);
    clock = new Date("2026-10-06T03:00:00Z");
    expect(await bookingAdmin.cancelDeparture(staff, past.departure.id, "nhầm")).toBeNull();
    expect((await row(past.code)).status).toBe("deposit_paid");
  });

  it("cancelling a departure closes it and cancels every live booking with a full refund of what was paid", async () => {
    const a = await paidBooking(10, "2026-10-10", 2);
    const b = await paidBooking(10, "2026-10-10", 1);
    await bookingAdmin.confirm(staff, b.code);
    await bookingAdmin.markBalancePaid(staff, b.code, "tiền mặt");
    const held = await booking.hold({ departureId: a.departure.id, name: "Mai", email: "mai@example.com", phone: "0912345679", adults: "1", locale: "vi", agree: "on" }, "ip-held");
    if (held.status !== "held") throw new Error(held.status);
    clearMail();

    await expect(bookingAdmin.cancelDeparture(staff, a.departure.id, " ")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await bookingAdmin.cancelDeparture(staff, a.departure.id, "Không đủ khách tối thiểu")).toEqual({ cancelled: 3 });

    expect((await db.select().from(departures).where(eq(departures.id, a.departure.id)))[0]!.status).toBe("closed");
    const [ra, rb, rh] = [await row(a.code), await row(b.code), await row(held.code)];
    expect(ra).toMatchObject({ status: "cancelled", refundDueVnd: ra.depositVnd, cancelReason: "Không đủ khách tối thiểu" });
    expect(rb).toMatchObject({ status: "cancelled", refundDueVnd: rb.totalVnd }); // deposit and the paid balance
    expect(rh).toMatchObject({ status: "cancelled", refundDueVnd: 0 }); // a hold paid nothing
    expect(sent.filter((m) => m.kind === "booking_cancelled")).toHaveLength(3);
    const { rows } = await container.admin!.listAudit({ targetId: a.departure.id });
    expect(rows.map((r) => r.action)).toEqual(["departure.cancel"]);
    expect(await bookingAdmin.cancelDeparture(staff, crypto.randomUUID(), "x")).toBeNull();
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

  it("cash: money in by the day it arrived, per channel; refunds paid out; receivables by trip date", async () => {
    await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
    const [soon] = await db.insert(departures).values({ tourSlug: "sapa-trekking-2d1n", date: "2026-11-05", capacity: 10 }).returning();
    const [past] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-10-01", capacity: 10 }).returning();
    const b = (code: string, departureId: string, status: "deposit_paid" | "confirmed" | "cancelled" | "refund_due", seats: number, extra: Record<string, unknown> = {}) => ({
      code, tokenHash: "x", departureId, status, holdExpiresAt: new Date("2030-01-01"), name: "A", email: "a@example.com", phone: "0900000000", locale: "vi",
      adults: seats, seats, unitPriceVnd: 1_000_000, totalVnd: seats * 1_000_000, depositVnd: seats * 300_000, ...extra,
    });
    const oct = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T03:00:00Z`);
    const inserted = await db.insert(bookings).values([
      b("BV-CSHA22", soon!.id, "deposit_paid", 2, { depositPaidAt: oct(10) }), // VNPay deposit 600k
      b("BV-CSHB22", soon!.id, "confirmed", 1, { depositPaidAt: oct(11), balancePaidAt: oct(20) }), // transfer 300k + staff balance 700k
      b("BV-CSHC22", soon!.id, "confirmed", 3, { depositPaidAt: new Date("2026-09-30T03:00:00Z"), source: "klook" }), // September: not in October cash; still owes 2.1M
      b("BV-CSHD22", past!.id, "cancelled", 1, { depositPaidAt: oct(2), refundDueVnd: 300_000, refundedVnd: 300_000, refundedAt: oct(5) }), // staff 300k in, 300k back
      b("BV-CSHE22", soon!.id, "refund_due", 1, { refundDueVnd: 300_000 }), // late deposit (no depositPaidAt): 300k in, owed back
    ]).returning({ id: bookings.id, code: bookings.code });
    const id = (code: string) => inserted.find((r) => r.code === code)!.id;
    await db.insert(bookingPayments).values([
      { bookingId: id("BV-CSHA22"), method: "vnpay", purpose: "deposit", txnRef: "T1", amountVnd: 600_000, status: "paid", paidAt: oct(10) },
      { bookingId: id("BV-CSHB22"), method: "transfer", purpose: "deposit", txnRef: "T2", amountVnd: 300_000, status: "paid", paidAt: oct(11) },
      { bookingId: id("BV-CSHB22"), method: "vnpay", purpose: "balance", txnRef: "T3", amountVnd: 700_000, status: "failed" },
      // A second transfer after the deposit was paid: money in, owed back.
      { bookingId: id("BV-CSHA22"), method: "transfer", purpose: "deposit", txnRef: "T4", amountVnd: 500_000, status: "paid", paidAt: oct(12) },
      { bookingId: id("BV-CSHE22"), method: "vnpay", purpose: "deposit", txnRef: "T5", amountVnd: 300_000, status: "paid", paidAt: oct(13) },
    ]);

    const cash = await createReports({ db }).cash("2026-10-01", "2026-10-31");
    expect(cash.byChannel).toEqual([
      { channel: "vnpay", depositsVnd: 600_000, balancesVnd: 0 },
      { channel: "transfer", depositsVnd: 300_000, balancesVnd: 0 },
      { channel: "staff", depositsVnd: 300_000, balancesVnd: 700_000 },
    ]);
    // Extra: A's second transfer (500k) and E's late deposit (300k).
    expect(cash).toMatchObject({ extraVnd: 800_000, collectedVnd: 2_700_000, refundedVnd: 300_000 });

    // Owed from trips on or after the given day, balance unpaid: A (1.4M) and C (2.1M); B paid, D past and cancelled.
    expect((await createReports({ db }).receivables("2026-10-14")).map((r) => [r.code, r.dueVnd])).toEqual([
      ["BV-CSHA22", 1_400_000],
      ["BV-CSHC22", 2_100_000],
    ]);
  });
});

describe("admin dashboard", () => {
  it("money collected (deposits and balances) this month vs last, 7-day bookings, fill, daily series, queue, departures, latest", async () => {
    await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
    const now = new Date("2026-10-20T05:00:00Z"); // 12:00 in Vietnam
    const [soon] = await db.insert(departures).values({ tourSlug: "sapa-trekking-2d1n", date: "2026-10-24", capacity: 10 }).returning();
    const [later] = await db.insert(departures).values({ tourSlug: "ninh-binh-day-tour", date: "2026-11-10", capacity: 10 }).returning();
    const b = (code: string, departureId: string, status: "deposit_paid" | "confirmed" | "held" | "cancelled", seats: number, extra: Record<string, unknown> = {}) => ({
      code, tokenHash: "x", departureId, status, holdExpiresAt: new Date("2030-01-01"), name: "A", email: "a@example.com", phone: "0900000000", locale: "vi",
      adults: seats, seats, unitPriceVnd: 1_000_000, totalVnd: seats * 1_000_000, depositVnd: seats * 300_000, ...extra,
    });
    await db.insert(bookings).values([
      // This month: deposit 600k (Oct 18) + balance of a September deposit 1.4M (Oct 19).
      b("BV-DSHA22", soon!.id, "deposit_paid", 2, { depositPaidAt: new Date("2026-10-18T03:00:00Z") }),
      b("BV-DSHB22", soon!.id, "confirmed", 2, { depositPaidAt: new Date("2026-09-10T03:00:00Z"), balancePaidAt: new Date("2026-10-19T03:00:00Z") }),
      // Last month, same days (Sep 1–20): 900k; after Sep 20 it does not count.
      b("BV-DSHC22", later!.id, "confirmed", 3, { depositPaidAt: new Date("2026-09-15T03:00:00Z") }),
      b("BV-DSHD22", later!.id, "confirmed", 1, { depositPaidAt: new Date("2026-09-25T03:00:00Z") }),
      // A hold expiring within 2 hours, and a cancelled booking owing a refund.
      b("BV-DSHE22", soon!.id, "held", 1, { holdExpiresAt: new Date(now.getTime() + 30 * 60_000) }),
      b("BV-DSHF22", later!.id, "cancelled", 1, { depositPaidAt: new Date("2026-10-05T03:00:00Z"), refundDueVnd: 300_000 }),
    ]);

    const data = await createDashboard({ db, now: () => now }).data();
    expect(data.collected).toEqual({ month: 600_000 + 1_400_000 + 300_000, previous: 900_000 + 600_000 });
    expect(data.bookings7d).toEqual({ count: 1, value: 2_000_000, previousCount: 0 });
    expect(data.fill30d).toEqual({ sold: 2 + 2 + 3 + 1, capacity: 20 });
    expect(data.daily).toHaveLength(30);
    expect(data.daily.at(-1)!.day).toBe("2026-10-20");
    expect(data.daily.find((d) => d.day === "2026-10-19")!.vnd).toBe(1_400_000);
    // Oct 24 is within 7 days with 4 of 10 seats sold: under half full.
    expect(data.queue).toMatchObject({ toConfirm: 1, refunds: 1, expiringHolds: 1, lowFill: 1 });
    expect(data.upcoming.map((d) => [d.date, d.sold])).toEqual([["2026-10-24", 4]]);
    expect(data.recent).toHaveLength(6);
  });

  it("'paid bookings, 7 days' is one number on every page: Vietnam days, cancelled bookings left out of the count", async () => {
    await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
    const now = new Date("2026-10-20T05:00:00Z"); // Oct 20, 12:00 in Vietnam: the 7 days are Oct 14–20
    const [d] = await db.insert(departures).values({ tourSlug: "sapa-trekking-2d1n", date: "2026-11-24", capacity: 20 }).returning();
    const b = (code: string, status: "deposit_paid" | "confirmed" | "cancelled", depositPaidAt: Date) => ({
      code, tokenHash: "x", departureId: d!.id, status, holdExpiresAt: new Date("2030-01-01"), name: "A", email: "a@example.com", phone: "0900000000", locale: "vi",
      adults: 2, seats: 2, unitPriceVnd: 1_000_000, totalVnd: 2_000_000, depositVnd: 600_000, depositPaidAt,
    });
    await db.insert(bookings).values([
      b("BV-WKA222", "deposit_paid", new Date("2026-10-20T01:00:00Z")), // today
      b("BV-WKB222", "confirmed", new Date("2026-10-13T17:10:00Z")), // Oct 14, 00:10 in Vietnam: first day, in
      b("BV-WKC222", "confirmed", new Date("2026-10-13T16:50:00Z")), // Oct 13, 23:50 in Vietnam: the week before
      b("BV-WKD222", "cancelled", new Date("2026-10-18T03:00:00Z")), // paid then cancelled: money in, not a sale
    ]);

    const overview = (await createDashboard({ db, now: () => now }).data()).bookings7d;
    const admin = createBookingAdmin({
      db, logger: createLogger({ write: () => {} }), mail: { send: async () => {} }, tourTitle: async () => "", tourExists: async () => true, now: () => now,
    });
    const page = await admin.stats();
    expect(overview).toEqual({ count: 2, value: 4_000_000, previousCount: 1 });
    expect(page).toMatchObject({ paidToday: 1, paidWeek: 2 });
    expect(page.paidWeek).toBe(overview.count);
    // Cash that came in over the same days, the cancelled booking's deposit included.
    expect(page.depositsWeekVnd).toBe(3 * 600_000);
  });
});
