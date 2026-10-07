import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import type { ProductContext } from "@/core/product/context";
import type { Db } from "@/db/client";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { bookingPayments, bookings, departures, type Booking, type BookingPayment, type BookingSource, type BookingStatus, type Departure } from "../schema/booking";
import { bookingStatusEmail, reminderEmail } from "./emails";
import type { ReceiveTransferResult } from "./deposits";
import { addDays, bookingRules, travellerKinds, vietnamDayStart, vietnamToday } from "./rules";
import { SOLD_STATUSES, takesSeats } from "./status";
import { manualBookingSchema } from "./validations";

export interface Actor {
  id: string;
  email: string;
}

/** "attention" = what staff must act on: refunds owed, paid deposits not yet confirmed, bank transfers to check. */
export type BookingFilter = BookingStatus | "attention" | "all";

export interface AdminBookingRow extends Pick<Booking, "id" | "code" | "status" | "name" | "email" | "phone" | "seats" | "totalVnd" | "depositVnd" | "refundDueVnd" | "refundedAt" | "createdAt" | "source" | "externalRef"> {
  tourSlug: string;
  date: string;
  kind: Departure["kind"];
}

export interface AdminDepartureRow extends Departure {
  /** Seats in paid/confirmed bookings. */
  sold: number;
  /** Seats in live holds. */
  held: number;
}

/**
 * One person on a departure. Bookings whose guest has not filled the traveller list give one row for the lead guest
 * with `missing` = how many people are not named yet.
 */
export interface PassengerRow {
  code: string;
  name: string;
  birthYear: number | null;
  kind: "adult" | "child" | "infant" | null;
  contact: string;
  phone: string;
  note: string;
  status: BookingStatus;
  missing: number;
}

/** Rows of one booking, travellers in party order (adults, children, infants). */
function passengerRows(b: Booking): PassengerRow[] {
  const base = { code: b.code, contact: b.name, phone: b.phone, note: b.note, status: b.status };
  const people = b.adults + b.children + b.infants;
  if (b.travellers.length === 0) return [{ ...base, name: b.name, birthYear: null, kind: null, missing: people }];
  const kinds = travellerKinds(b);
  return b.travellers.map((p, i) => ({ ...base, name: p.name, birthYear: p.birthYear, kind: kinds[i] ?? null, missing: 0 }));
}

export interface BookingAdmin {
  list(options?: { filter?: BookingFilter; source?: BookingSource; tourSlug?: string; from?: string; to?: string; query?: string; page?: number; pageSize?: number }): Promise<{ rows: AdminBookingRow[]; total: number }>;
  get(code: string): Promise<{ booking: Booking; departure: Departure; payments: BookingPayment[] } | null>;
  confirm(actor: Actor, code: string): Promise<boolean>;
  cancel(actor: Actor, code: string, input: { reason: string; refund: boolean }): Promise<boolean>;
  markRefunded(actor: Actor, code: string, input: { note: string }): Promise<boolean>;
  setStaffNote(actor: Actor, code: string, note: string): Promise<boolean>;
  /** Staff got the rest of the total outside the website (cash, transfer) (D5). Audited. */
  markBalancePaid(actor: Actor, code: string, note: string): Promise<boolean>;
  /** Staff saw the bank transfer for a held (or just expired) booking: records the deposit. Audited. */
  receiveTransfer(actor: Actor, code: string, input: { amountVnd: number; bankRef: string }): Promise<ReceiveTransferResult>;
  /**
   * Staff-entered booking (phone, Zalo, OTA), paid outside the website. Takes seats under the same departure lock as
   * online holds, so the website and OTAs never oversell. Audited.
   */
  createManual(actor: Actor, raw: Record<string, unknown>): Promise<ManualBookingResult>;

  listDepartures(options: { tourSlug?: string; from: string; to: string }): Promise<AdminDepartureRow[]>;
  /** Passenger list of one departure (H1): paid and confirmed bookings, one row per traveller, for the guide. */
  passengers(departureId: string): Promise<{ departure: Departure; rows: PassengerRow[] } | null>;
  addDepartures(actor: Actor, input: { tourSlug: string; dates: string[]; capacity: number; priceVnd: number | null }): Promise<number>;
  updateDeparture(actor: Actor, id: string, input: { capacity?: number; priceVnd?: number | null; status?: Departure["status"] }): Promise<boolean>;

  stats(): Promise<{ paidToday: number; paidWeek: number; depositsWeekVnd: number; attention: number; upcoming: { date: string; tourSlug: string; seats: number }[] }>;
  /** Periodic: reminder emails 3 days before departure (once per booking). Returns how many were sent. */
  sendReminders(): Promise<number>;
}

export type ManualBookingResult =
  | { status: "created"; code: string }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "sold_out"; seatsLeft: number }
  | { status: "unavailable" };

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE = /^BV-[A-Z2-9]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const REMINDER_DAYS = 3;

/** Paid deposits to confirm, refunds owed, and transfers the guest chose that staff have not recorded yet. */
const needsAttention = () =>
  or(
    eq(bookings.status, "deposit_paid"),
    and(sql`${bookings.refundDueVnd} > 0`, isNull(bookings.refundedAt)),
    and(
      inArray(bookings.status, ["held", "expired"]),
      sql`exists (select 1 from ${bookingPayments} p where p.booking_id = ${bookings.id} and p.method = 'transfer' and p.status = 'pending')`,
    ),
  )!;

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function createBookingAdmin(deps: {
  db: Db;
  logger: Logger;
  mail: MailPort;
  audit?: ProductContext["audit"];
  tourTitle: (slug: string, locale: string) => Promise<string>;
  tourExists: (slug: string) => Promise<boolean>;
  /** Deposit service's receiveTransfer with the site links bound (emails). */
  receiveTransfer?: (code: string, input: { amountVnd: number; bankRef: string }) => Promise<ReceiveTransferResult>;
  now?: () => Date;
}): BookingAdmin {
  const { db, logger } = deps;
  const now = deps.now ?? (() => new Date());

  const audited = (actor: Actor, action: string, targetId: string, metadata: Record<string, unknown>, work: () => Promise<boolean>) => {
    if (!deps.audit) throw new AppError("MODULE_DISABLED", "Admin module is off");
    return deps.audit.audited(actor, { action, targetType: action.startsWith("departure") ? "departure" : "booking", targetId, metadata }, work);
  };

  const load = async (code: string) => {
    if (!CODE.test(code)) return null;
    const [row] = await db.select({ b: bookings, d: departures }).from(bookings).innerJoin(departures, eq(departures.id, bookings.departureId)).where(eq(bookings.code, code));
    return row ?? null;
  };

  /** Emails never fail an admin action that already happened. */
  const send = async (message: Parameters<MailPort["send"]>[0], code: string) =>
    deps.mail.send(message).catch((error) => logger.error("booking.email_failed", { code, kind: message.kind, error }));
  /** Guest emails are skipped for bookings an OTA handles (guestEmails = false) or without an address. */
  const sendToGuest = async (booking: Booking, message: Parameters<MailPort["send"]>[0]) => {
    if (booking.guestEmails && booking.email) await send(message, booking.code);
  };

  const seatCounts = (at: Date) => ({
    sold: sql<number>`coalesce((select sum(b.seats) from bookings b where b.departure_id = departures.id and b.status in ('deposit_paid', 'confirmed')), 0)::int`,
    held: sql<number>`coalesce((select sum(b.seats) from bookings b where b.departure_id = departures.id and b.status = 'held' and b.hold_expires_at > ${at.toISOString()}), 0)::int`,
  });

  return {
    async list({ filter = "attention", source, tourSlug, from, to, query, page = 1, pageSize = 25 } = {}) {
      const where: SQL[] = [];
      if (filter === "attention") where.push(needsAttention());
      else if (filter !== "all") where.push(eq(bookings.status, filter));
      if (tourSlug) where.push(eq(departures.tourSlug, tourSlug));
      if (source) where.push(eq(bookings.source, source));
      if (from && DAY.test(from)) where.push(gte(departures.date, from));
      if (to && DAY.test(to)) where.push(lte(departures.date, to));
      const q = query?.trim().slice(0, 100);
      if (q) where.push(or(ilike(bookings.code, like(q)), ilike(bookings.name, like(q)), ilike(bookings.email, like(q)), ilike(bookings.phone, like(q)))!);
      const condition = where.length ? and(...where) : undefined;
      const size = Math.min(Math.max(pageSize, 1), 100);
      const rows = await db
        .select({
          id: bookings.id,
          code: bookings.code,
          status: bookings.status,
          name: bookings.name,
          email: bookings.email,
          phone: bookings.phone,
          seats: bookings.seats,
          totalVnd: bookings.totalVnd,
          depositVnd: bookings.depositVnd,
          refundDueVnd: bookings.refundDueVnd,
          refundedAt: bookings.refundedAt,
          createdAt: bookings.createdAt,
          source: bookings.source,
          externalRef: bookings.externalRef,
          tourSlug: departures.tourSlug,
          date: departures.date,
          kind: departures.kind,
        })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(condition)
        .orderBy(filter === "attention" ? asc(departures.date) : desc(bookings.createdAt))
        .limit(size)
        .offset((Math.max(page, 1) - 1) * size);
      const [{ total }] = (await db.select({ total: count() }).from(bookings).innerJoin(departures, eq(departures.id, bookings.departureId)).where(condition)) as [{ total: number }];
      return { rows, total };
    },

    async get(code) {
      const row = await load(code);
      if (!row) return null;
      const payments = await db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, row.b.id)).orderBy(desc(bookingPayments.createdAt));
      return { booking: row.b, departure: row.d, payments };
    },

    async confirm(actor, code) {
      let updated: Booking | undefined;
      const changed = await audited(actor, "booking.confirm", code, {}, async () => {
        [updated] = await db
          .update(bookings)
          .set({ status: "confirmed", confirmedAt: now() })
          .where(and(eq(bookings.code, code), eq(bookings.status, "deposit_paid")))
          .returning();
        return Boolean(updated);
      });
      if (updated) {
        const row = (await load(code))!;
        await sendToGuest(updated, bookingStatusEmail({ booking: updated, departure: row.d, title: await deps.tourTitle(row.d.tourSlug, updated.locale), kind: "confirmed" }));
      }
      return changed;
    },

    async cancel(actor, code, { reason, refund }) {
      const text = reason.trim().slice(0, 500);
      if (!text) throw new AppError("VALIDATION_ERROR", "Reason required");
      let updated: Booking | undefined;
      const changed = await audited(actor, "booking.cancel", code, { reason: text, refund }, async () => {
        [updated] = await db
          .update(bookings)
          .set({
            status: "cancelled",
            cancelledAt: now(),
            cancelReason: text,
            // Refund the deposit only when it was paid (held bookings paid nothing).
            ...(refund ? { refundDueVnd: sql`${bookings.refundDueVnd} + case when ${inArray(bookings.status, [...SOLD_STATUSES])} then ${bookings.depositVnd} else 0 end` } : {}),
          })
          .where(and(eq(bookings.code, code), inArray(bookings.status, ["held", "deposit_paid", "confirmed"])))
          .returning();
        return Boolean(updated);
      });
      if (updated) {
        const row = (await load(code))!;
        await sendToGuest(updated, bookingStatusEmail({ booking: updated, departure: row.d, title: await deps.tourTitle(row.d.tourSlug, updated.locale), kind: "cancelled" }));
      }
      return changed;
    },

    async receiveTransfer(actor, code, input) {
      if (!deps.receiveTransfer || !CODE.test(code)) return "not_found";
      const receive = deps.receiveTransfer;
      let result: ReceiveTransferResult = "not_found"; // set inside the audited work
      await audited(actor, "booking.transfer_received", code, { amountVnd: input.amountVnd, bankRef: input.bankRef.trim().slice(0, 100) }, async () => {
        result = await receive(code, input);
        return result === "deposit_paid" || result === "refund_due";
      });
      return result;
    },

    async markBalancePaid(actor, code, note) {
      return audited(actor, "booking.balance_paid", code, { note: note.trim().slice(0, 200) }, async () => {
        const done = await db
          .update(bookings)
          .set({ balancePaidAt: now() })
          .where(and(eq(bookings.code, code), inArray(bookings.status, SOLD_STATUSES), isNull(bookings.balancePaidAt)))
          .returning({ id: bookings.id });
        return done.length > 0;
      });
    },

    async markRefunded(actor, code, { note }) {
      return audited(actor, "booking.refunded", code, { note: note.trim().slice(0, 500) }, async () => {
        const done = await db
          .update(bookings)
          .set({
            refundedAt: now(),
            refundNote: note.trim().slice(0, 500),
            // A late deposit (refund_due) ends as cancelled once the money is back.
            status: sql`case when ${bookings.status} = 'refund_due' then 'cancelled' else ${bookings.status} end`,
          })
          .where(and(eq(bookings.code, code), sql`${bookings.refundDueVnd} > 0`, isNull(bookings.refundedAt)))
          .returning({ id: bookings.id });
        return done.length > 0;
      });
    },

    async setStaffNote(actor, code, note) {
      return audited(actor, "booking.note", code, {}, async () => {
        const done = await db.update(bookings).set({ staffNote: note.trim().slice(0, 2000) }).where(eq(bookings.code, code)).returning({ id: bookings.id });
        return done.length > 0;
      });
    },

    async createManual(actor, raw) {
      const parsed = manualBookingSchema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
        return { status: "invalid", fieldErrors };
      }
      const input = parsed.data;
      let result = { status: "unavailable" } as ManualBookingResult; // set inside the audited transaction
      const code = `BV-${Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")}`;
      await audited(actor, "booking.create_manual", code, { source: input.source, externalRef: input.externalRef || null }, async () => {
        result = await db.transaction(async (tx): Promise<ManualBookingResult> => {
          const at = now();
          // Same lock as online holds: the website, OTAs and staff share one seat count.
          const [departure] = await tx.select().from(departures).where(eq(departures.id, input.departureId)).for("update");
          // Staff may enter bookings inside the online cut-off, but not on a past or closed date.
          if (!departure || departure.kind !== "group" || departure.status !== "open" || departure.date < vietnamToday(at)) return { status: "unavailable" };
          const [row] = await tx
            .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
            .from(bookings)
            .where(and(eq(bookings.departureId, departure.id), takesSeats(at)));
          const seats = input.adults + input.children;
          const seatsLeft = departure.capacity - (row?.taken ?? 0);
          if (seats > seatsLeft) return { status: "sold_out", seatsLeft: Math.max(0, seatsLeft) };

          await tx.insert(bookings).values({
            code,
            // No guest link for staff-entered bookings: a random token nobody knows.
            tokenHash: createHash("sha256").update(randomBytes(24)).digest("hex"),
            departureId: departure.id,
            status: input.status,
            holdExpiresAt: at,
            name: input.name,
            email: input.email,
            phone: input.phone,
            note: input.note,
            locale: input.locale,
            adults: input.adults,
            children: input.children,
            infants: input.infants,
            seats,
            // What was actually received, per seat (OTA net prices differ from the website price).
            unitPriceVnd: Math.round(input.amountVnd / seats),
            totalVnd: input.amountVnd,
            depositVnd: Math.ceil((input.amountVnd * bookingRules.depositRate) / 1000) * 1000,
            depositPaidAt: at,
            confirmedAt: input.status === "confirmed" ? at : null,
            source: input.source,
            externalRef: input.externalRef || null,
            guestEmails: input.guestEmails,
          });
          return { status: "created", code };
        });
        return result.status === "created";
      });
      if (result.status === "created") logger.info("booking.created_manual", { code: result.code, source: input.source });
      return result;
    },

    async passengers(departureId) {
      if (!UUID.test(departureId)) return null;
      const [departure] = await db.select().from(departures).where(eq(departures.id, departureId));
      if (!departure) return null;
      const rows = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.departureId, departureId), inArray(bookings.status, [...SOLD_STATUSES])))
        .orderBy(asc(bookings.createdAt));
      return { departure, rows: rows.flatMap(passengerRows) };
    },

    async listDepartures({ tourSlug, from, to }) {
      // Private departures belong to one booking each: they are managed from the booking, not here.
      const where = [gte(departures.date, from), lte(departures.date, to), eq(departures.kind, "group")];
      if (tourSlug) where.push(eq(departures.tourSlug, tourSlug));
      const rows = await db
        .select({ d: departures, ...seatCounts(now()) })
        .from(departures)
        .where(and(...where))
        .orderBy(asc(departures.date), asc(departures.tourSlug));
      return rows.map((r) => ({ ...r.d, sold: r.sold, held: r.held }));
    },

    async addDepartures(actor, { tourSlug, dates, capacity, priceVnd }) {
      if (!(await deps.tourExists(tourSlug))) throw new AppError("VALIDATION_ERROR", "Unknown tour");
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new AppError("VALIDATION_ERROR", "Invalid capacity");
      if (priceVnd !== null && (!Number.isInteger(priceVnd) || priceVnd < 10_000 || priceVnd > 100_000_000)) throw new AppError("VALIDATION_ERROR", "Invalid price");
      const today = vietnamToday(now());
      const valid = [...new Set(dates)].filter((d) => DAY.test(d) && d >= today && d <= addDays(today, 730)).slice(0, 120);
      if (valid.length === 0) throw new AppError("VALIDATION_ERROR", "No valid dates");
      let added = 0;
      await audited(actor, "departure.add", tourSlug, { dates: valid, capacity, priceVnd }, async () => {
        const rows = await db
          .insert(departures)
          .values(valid.map((date) => ({ tourSlug, date, capacity, priceVnd })))
          .onConflictDoNothing()
          .returning({ id: departures.id });
        added = rows.length;
        return added > 0;
      });
      return added;
    },

    async updateDeparture(actor, id, input) {
      if (!UUID.test(id)) throw new AppError("NOT_FOUND");
      if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100)) throw new AppError("VALIDATION_ERROR", "Invalid capacity");
      if (input.priceVnd != null && (!Number.isInteger(input.priceVnd) || input.priceVnd < 10_000 || input.priceVnd > 100_000_000)) throw new AppError("VALIDATION_ERROR", "Invalid price");
      return audited(actor, "departure.update", id, input, () =>
        db.transaction(async (tx) => {
          // Same lock as holds: no seat can be sold between the check and the update.
          const [d] = await tx.select().from(departures).where(eq(departures.id, id)).for("update");
          if (!d) throw new AppError("NOT_FOUND");
          if (input.capacity !== undefined) {
            const [row] = await tx
              .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
              .from(bookings)
              .where(and(eq(bookings.departureId, id), takesSeats(now())));
            if (input.capacity < (row?.taken ?? 0)) throw new AppError("VALIDATION_ERROR", "Capacity below seats taken", { details: { taken: row?.taken } });
          }
          const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
          if (Object.keys(set).length === 0) return false;
          await tx.update(departures).set(set).where(eq(departures.id, id));
          return true;
        }),
      );
    },

    async stats() {
      const at = now();
      const today = vietnamToday(at);
      const dayStart = vietnamDayStart(today);
      const weekStart = new Date(dayStart.getTime() - 6 * 86_400_000);
      const [paid] = await db
        .select({
          today: sql<number>`count(*) filter (where ${bookings.depositPaidAt} >= ${dayStart.toISOString()})::int`,
          week: sql<number>`count(*)::int`,
          deposits: sql<number>`coalesce(sum(${bookings.depositVnd}), 0)::bigint`,
        })
        .from(bookings)
        .where(gte(bookings.depositPaidAt, weekStart));
      const [attention] = await db
        .select({ n: count() })
        .from(bookings)
        .where(needsAttention());
      const upcoming = await db
        .select({ date: departures.date, tourSlug: departures.tourSlug, seats: sql<number>`sum(${bookings.seats})::int` })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(and(inArray(bookings.status, SOLD_STATUSES), gte(departures.date, today), lte(departures.date, addDays(today, 7))))
        .groupBy(departures.date, departures.tourSlug)
        .orderBy(asc(departures.date));
      return { paidToday: paid?.today ?? 0, paidWeek: paid?.week ?? 0, depositsWeekVnd: Number(paid?.deposits ?? 0), attention: attention?.n ?? 0, upcoming };
    },

    async sendReminders() {
      const today = vietnamToday(now());
      // Claim first (reminderSentAt), then send: a crash may skip one email but never sends twice.
      const claimed = await db
        .update(bookings)
        .set({ reminderSentAt: now() })
        .where(
          and(
            inArray(bookings.status, SOLD_STATUSES),
            isNull(bookings.reminderSentAt),
            eq(bookings.guestEmails, true),
            sql`${bookings.email} <> ''`,
            sql`${bookings.departureId} in (select id from departures where date > ${today} and date <= ${addDays(today, REMINDER_DAYS)})`,
          ),
        )
        .returning();
      const byId = new Map(
        claimed.length ? (await db.select().from(departures).where(inArray(departures.id, [...new Set(claimed.map((b) => b.departureId))]))).map((d) => [d.id, d]) : [],
      );
      for (const b of claimed) {
        const d = byId.get(b.departureId)!;
        await send(reminderEmail({ booking: b, departure: d, title: await deps.tourTitle(d.tourSlug, b.locale) }), b.code);
      }
      if (claimed.length) logger.info("booking.reminders_sent", { count: claimed.length });
      return claimed.length;
    },
  };
}
