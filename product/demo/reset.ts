// Public demo site (DEMO_MODE): every day the booking data goes back to a known sample, so visitors always find
// bookings in every state, departures in the coming weeks and the two demo staff accounts.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import { users } from "@/core/users/schema";
import type { Db } from "@/db/client";
import { bookingPayments, bookings, departures, discountCodes, type BookingStatus } from "../schema/booking";
import { siteSettings } from "../schema/settings";
import { staffRoles } from "../schema/staff";
import { addDays, bookingRules, vietnamToday } from "../booking/rules";
import { DEMO_STAFF } from "./staff";

/** Weekdays (0 = Sunday) and seats per destination, as scripts/seed-departures.ts; other tours leave on Saturdays. */
const SCHEDULE: Record<string, { days: number[]; capacity: number }> = {
  "ha-long": { days: [2, 4, 6], capacity: 16 },
  "ninh-binh": { days: [1, 3, 5, 6, 0], capacity: 16 },
  sapa: { days: [5], capacity: 12 },
};
const OTHER = { days: [6], capacity: 16 };
const WEEKS = 8;
const RESET_KEY = "demo_reset";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => `BV-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
const newTokenHash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
const roundUp1000 = (n: number) => Math.ceil(n / 1000) * 1000;

const GUESTS = ["Ngô Thanh Tùng", "Đặng Thu Trang", "Lý Hoàng Nam", "Phan Ngọc Ánh", "Trịnh Văn Hải", "Mai Khánh Linh", "Đinh Quốc Bảo", "Tạ Minh Thư", "Hồ Gia Huy", "Dương Bích Ngọc", "Cao Đức Mạnh", "Lương Thảo Vy", "Emma Brown", "Lucas Martin", "Kim Ji-woo", "Tanaka Yui"];

/** Small seeded generator (mulberry32): the sample history keeps its shape from one reset to the next. */
function seeded(seed: string) {
  let a = [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoResetDeps {
  db: Db;
  logger: Logger;
  /** Published tours with their adult price (VND). */
  tours: () => Promise<{ slug: string; priceVnd: number }[]>;
  now?: () => Date;
}

export function createDemoReset(deps: DemoResetDeps) {
  const { db } = deps;
  const now = () => deps.now?.() ?? new Date();

  async function reset(): Promise<void> {
    const at = now();
    const today = vietnamToday(at);
    const tours = (await deps.tours()).filter((t) => t.priceVnd > 0).sort((a, b) => a.slug.localeCompare(b.slug));
    if (tours.length === 0) {
      deps.logger.warn("demo.reset_skipped", { reason: "no published tours" });
      return;
    }

    await db.transaction(async (tx) => {
      // Visitors' bookings, payments, feedback, discount codes and demo emails go; tours, settings and accounts stay.
      await tx.execute(sql`TRUNCATE trip_feedback, booking_payments, bookings, departures, discount_codes, demo_emails RESTART IDENTITY CASCADE`);

      // Departures for the next weeks, plus one finished trip (reports, feedback).
      const rows: { tourSlug: string; date: string; capacity: number; minGuests?: number }[] = [];
      for (const tour of tours) {
        const { days, capacity } = Object.entries(SCHEDULE).find(([d]) => tour.slug.startsWith(d))?.[1] ?? OTHER;
        for (let i = 1; i <= WEEKS * 7; i++) {
          const date = addDays(today, i);
          if (days.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) rows.push({ tourSlug: tour.slug, date, capacity });
        }
      }
      const inserted = await tx.insert(departures).values(rows).returning();
      const [past] = await tx.insert(departures).values({ tourSlug: tours[0]!.slug, date: addDays(today, -10), capacity: 16, status: "closed" }).returning();
      const upcoming = inserted.filter((d) => d.date >= addDays(today, 2)).sort((a, b) => a.date.localeCompare(b.date) || a.tourSlug.localeCompare(b.tourSlug));
      const price = (slug: string) => tours.find((t) => t.slug === slug)!.priceVnd;
      const pick = (i: number) => upcoming[i % upcoming.length]!;

      // A date a few days away below its minimum of guests (dashboard "chưa đủ khách", cancel a whole departure).
      const short = upcoming.find((d) => d.date >= addDays(today, 4) && d.date <= addDays(today, 6)) ?? pick(0);
      await tx.update(departures).set({ minGuests: 8 }).where(eq(departures.id, short.id));

      const hoursAgo = (h: number) => new Date(at.getTime() - h * 3_600_000);
      const seatsTaken = new Map<string, number>();
      const fits = (d: { id: string; capacity: number }, seats: number) => (seatsTaken.get(d.id) ?? 0) + seats <= d.capacity;
      const book = async (
        departure: { id: string; tourSlug: string },
        b: { status: BookingStatus; name: string; phone: string; adults: number; children?: number; source?: "website" | "klook" | "phone"; externalRef?: string; paid?: Date; balance?: Date; confirmed?: Date; cancelled?: { reason: string; refund: boolean }; holdMinutes?: number; travellers?: boolean; payment?: "vnpay" | "transfer" | "pending_transfer" },
      ) => {
        const unit = price(departure.tourSlug);
        const seats = b.adults + (b.children ?? 0);
        const totalVnd = unit * seats;
        const created = b.paid ? new Date(b.paid.getTime() - 10 * 60_000) : undefined;
        seatsTaken.set(departure.id, (seatsTaken.get(departure.id) ?? 0) + seats);
        const depositVnd = roundUp1000(totalVnd * bookingRules.depositRate);
        const [row] = await tx
          .insert(bookings)
          .values({
            code: newCode(),
            tokenHash: newTokenHash(),
            departureId: departure.id,
            status: b.status,
            holdExpiresAt: new Date(at.getTime() + (b.holdMinutes ?? -60) * 60_000),
            name: b.name,
            email: `${b.name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/[^a-z]+/g, ".")}@example.com`,
            phone: b.phone,
            locale: "vi",
            adults: b.adults,
            children: b.children ?? 0,
            seats,
            unitPriceVnd: unit,
            totalVnd,
            depositVnd,
            depositPaidAt: b.paid ?? null,
            balancePaidAt: b.balance ?? null,
            confirmedAt: b.confirmed ?? null,
            cancelledAt: b.cancelled ? hoursAgo(5) : null,
            cancelReason: b.cancelled?.reason ?? null,
            refundDueVnd: b.cancelled?.refund ? depositVnd : 0,
            travellers: b.travellers ? Array.from({ length: seats }, (_, i) => ({ name: `${b.name} ${i + 1}`, birthYear: 1985 + i })) : [],
            source: b.source ?? "website",
            externalRef: b.externalRef ?? null,
            guestEmails: b.source === undefined || b.source === "website",
            // A paid booking was made just before the guest paid (history included), never after.
            ...(created ? { createdAt: created, updatedAt: created } : {}),
          })
          .returning();
        if (b.payment) {
          const paid = b.payment !== "pending_transfer";
          await tx.insert(bookingPayments).values({
            bookingId: row!.id,
            method: b.payment === "vnpay" ? "vnpay" : "transfer",
            txnRef: `${row!.code.slice(3)}${b.payment === "vnpay" ? "01" : "CK"}`,
            amountVnd: depositVnd,
            status: paid ? "paid" : "pending",
            paidAt: paid ? (b.paid ?? at) : null,
            providerTxnNo: paid ? `DEMO${randomInt(100000, 999999)}` : null,
          });
        }
      };

      await book(pick(0), { status: "held", name: "Nguyễn Thu Hà", phone: "0912 345 678", adults: 2, holdMinutes: 40, payment: "pending_transfer" });
      await book(pick(1), { status: "deposit_paid", name: "Trần Minh Quân", phone: "0987 654 321", adults: 3, children: 1, paid: hoursAgo(2), payment: "vnpay" });
      await book(pick(2), { status: "deposit_paid", name: "Lê Phương Anh", phone: "0903 112 233", adults: 2, paid: hoursAgo(20), payment: "transfer" });
      await book(short, { status: "confirmed", name: "Phạm Đức Long", phone: "0934 556 677", adults: 2, paid: hoursAgo(50), confirmed: hoursAgo(48), payment: "vnpay" });
      await book(pick(3), { status: "confirmed", name: "Hoàng Lan Chi", phone: "0977 889 900", adults: 4, paid: hoursAgo(80), confirmed: hoursAgo(78), balance: hoursAgo(10), travellers: true, payment: "transfer" });
      await book(pick(4), { status: "confirmed", name: "Sarah Miller", phone: "+44 7700 900123", adults: 2, source: "klook", externalRef: "KL-4829173", paid: hoursAgo(30), confirmed: hoursAgo(30) });
      await book(pick(5), { status: "cancelled", name: "Đỗ Văn Nam", phone: "0966 123 456", adults: 2, paid: hoursAgo(72), cancelled: { reason: "Khách bận việc gia đình, xin huỷ", refund: true }, payment: "vnpay" });
      await book(pick(6), { status: "expired", name: "Vũ Thị Mai", phone: "0945 678 901", adults: 2, holdMinutes: -180 });
      await book(past!, { status: "confirmed", name: "Bùi Quang Huy", phone: "0911 222 333", adults: 2, paid: hoursAgo(24 * 20), confirmed: hoursAgo(24 * 19), balance: hoursAgo(24 * 11), travellers: true, payment: "vnpay" });

      // History, so the dashboard and reports look like a business that has been running: trips of the last 90 days
      // (done and paid in full, a few cancelled without refund) and bookings of the last 3 weeks for coming trips.
      // Settled statuses only: the to-do queue stays exactly the sample above. Seeded: the same shape every day.
      const rand = seeded(today);
      const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
      const guest = () => ({ name: GUESTS[between(0, GUESTS.length - 1)]!, phone: `09${between(10_000_000, 99_999_999)}` });
      const pastRows = Array.from({ length: 45 }, (_, i) => ({ tourSlug: tours[i % tours.length]!.slug, date: addDays(today, -(90 - i * 2)), capacity: 16, status: "closed" as const }));
      for (const d of await tx.insert(departures).values(pastRows).returning()) {
        const tripStart = new Date(`${d.date}T01:00:00Z`).getTime();
        for (let n = between(1, 3); n > 0; n--) {
          const paid = new Date(tripStart - between(3, 30) * 86_400_000);
          const cancelled = rand() < 0.1;
          await book(d, {
            status: cancelled ? "cancelled" : "confirmed", ...guest(), adults: between(1, 4), source: rand() < 0.2 ? "phone" : "website",
            paid, confirmed: paid, balance: cancelled ? undefined : new Date(tripStart - 86_400_000),
            cancelled: cancelled ? { reason: "Khách huỷ sát ngày, không hoàn cọc", refund: false } : undefined, payment: rand() < 0.6 ? "vnpay" : "transfer",
          });
        }
      }
      const open = upcoming.filter((d) => d.id !== short.id);
      // Spread over the coming dates; a date never gets more guests than it has seats.
      for (let i = 0, placed = 0; placed < 30 && i < open.length * 2; i++) {
        const d = open[between(0, open.length - 1)]!;
        const adults = between(1, 3);
        if (!fits(d, adults)) continue;
        const paid = hoursAgo(between(3, 21 * 24));
        await book(d, { status: "confirmed", ...guest(), adults, paid, confirmed: paid, payment: rand() < 0.6 ? "vnpay" : "transfer" });
        placed++;
      }

      await tx.insert(discountCodes).values([
        { code: "CHAODEMO", kind: "percent", value: 10, validFrom: addDays(today, -7), validTo: addDays(today, 60), note: "Mã mẫu: giảm 10%" },
        { code: "HE2026", kind: "amount", value: 200_000, validFrom: addDays(today, -90), validTo: addDays(today, -1), minTotalVnd: 2_000_000, note: "Mã mẫu đã hết hạn" },
      ]);

      // Demo staff: editors with their staff role (the starter signs them in from /demo, never as admins).
      for (const s of DEMO_STAFF) {
        const [u] = await tx
          .insert(users)
          .values({ email: s.email, name: s.name, emailVerified: true, role: "editor" })
          .onConflictDoUpdate({ target: users.email, set: { role: "editor", status: "active", name: s.name } })
          .returning({ id: users.id });
        await tx.insert(staffRoles).values({ userId: u!.id, role: s.role }).onConflictDoUpdate({ target: staffRoles.userId, set: { role: s.role } });
      }

      await tx
        .insert(siteSettings)
        .values({ key: RESET_KEY, value: { day: today } })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: { day: today } } });
    });
    deps.logger.info("demo.reset", { day: today });
  }

  return {
    reset,
    /** Once per Vietnam day (the jobs tick runs more often). */
    async resetIfDue(): Promise<boolean> {
      const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, RESET_KEY));
      if ((row?.value as { day?: string } | undefined)?.day === vietnamToday(now())) return false;
      await reset();
      return true;
    },
  };
}
