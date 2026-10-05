import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import type { RateLimiter } from "@/core/security/rate-limit";
import type { Db } from "@/db/client";
import { bookings, departures, type Booking, type Departure } from "../schema/booking";
import { addDays, bookingRules, isBookableDate, quote, vietnamToday } from "./rules";
import { bookingInputSchema } from "./validations";

export type BookingField = "departureId" | "name" | "email" | "phone" | "adults" | "children" | "infants" | "note" | "agree";
export type BookingFieldError = "required" | "invalid" | "too_long" | "too_many" | "must_agree";

export type HoldResult =
  | { status: "held"; code: string; token: string }
  | { status: "invalid"; fieldErrors: Partial<Record<BookingField, BookingFieldError>> }
  /** Not enough seats left (seatsLeft may be 0). */
  | { status: "sold_out"; seatsLeft: number }
  /** Unknown, closed or past-cutoff departure. */
  | { status: "unavailable" }
  | { status: "rate_limited" };

export interface DepartureView extends Departure {
  seatsLeft: number;
  unitPriceVnd: number;
  bookable: boolean;
}

export interface BookingView extends Booking {
  departure: Departure;
  /** Held and past its expiry, even before anything marks it "expired". */
  isExpired: boolean;
}

export interface BookingService {
  /** Upcoming departures of a tour (from today), with live seat counts. */
  listDepartures(tourSlug: string): Promise<DepartureView[]>;
  getDeparture(id: string): Promise<DepartureView | null>;
  /** Validates, re-counts seats under a row lock and holds them for bookingRules.holdMinutes. */
  hold(raw: Record<string, unknown>, clientKey: string): Promise<HoldResult>;
  /** Guest lookup: a wrong code or token both give null (indistinguishable). */
  getForGuest(code: string, token: string): Promise<BookingView | null>;
  /** Marks stale holds as expired. Returns how many. */
  expireStale(): Promise<number>;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const CODE = /^BV-[A-Z2-9]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD_ERRORS = ["required", "invalid", "too_long", "too_many", "must_agree"] as const;

const newCode = () => `BV-${Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")}`;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createBookingService(deps: {
  db: Db;
  logger: Logger;
  rateLimiter: RateLimiter;
  /** Adult list price of a tour (VND), null if the tour does not exist. */
  tourPrice: (slug: string) => number | null;
  now?: () => Date;
}): BookingService {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  /** Seats taken on a departure: paid/confirmed bookings plus holds that have not expired. */
  // Columns are written out with table names: inside a correlated subquery Drizzle would render a bare "id".
  const takenSql = (at: Date) => sql<number>`coalesce((
    select sum(b.seats) from bookings b
    where b.departure_id = departures.id
      and (b.status in ('deposit_paid', 'confirmed') or (b.status = 'held' and b.hold_expires_at > ${at.toISOString()}))
  ), 0)::int`;

  const view = (d: Departure, taken: number, at: Date): DepartureView | null => {
    const listPrice = deps.tourPrice(d.tourSlug);
    if (listPrice === null) return null;
    const seatsLeft = Math.max(0, d.capacity - taken);
    return { ...d, seatsLeft, unitPriceVnd: d.priceVnd ?? listPrice, bookable: d.status === "open" && seatsLeft > 0 && isBookableDate(d.date, at) };
  };

  return {
    async listDepartures(tourSlug) {
      const at = now();
      const today = vietnamToday(at);
      const rows = await db
        .select({ d: departures, taken: takenSql(at) })
        .from(departures)
        .where(and(eq(departures.tourSlug, tourSlug), gte(departures.date, today), lte(departures.date, addDays(today, 366))))
        .orderBy(asc(departures.date));
      return rows.map((r) => view(r.d, r.taken, at)).filter((v) => v !== null);
    },

    async getDeparture(id) {
      if (!UUID.test(id)) return null;
      const at = now();
      const [row] = await db.select({ d: departures, taken: takenSql(at) }).from(departures).where(eq(departures.id, id));
      return row ? view(row.d, row.taken, at) : null;
    },

    async hold(raw, clientKey) {
      // Honeypot: answer like a rate limit, without touching the database.
      if (typeof raw.website === "string" && raw.website.length > 0) {
        deps.logger.warn("booking.honeypot");
        return { status: "rate_limited" };
      }
      const parsed = bookingInputSchema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Partial<Record<BookingField, BookingFieldError>> = {};
        for (const issue of parsed.error.issues) {
          fieldErrors[issue.path[0] as BookingField] ??= FIELD_ERRORS.find((e) => e === issue.message) ?? "invalid";
        }
        return { status: "invalid", fieldErrors };
      }
      if (!(await deps.rateLimiter.limit(clientKey)).success) return { status: "rate_limited" };
      const input = parsed.data;
      const token = randomBytes(24).toString("base64url");

      const result = await db.transaction(async (tx): Promise<HoldResult> => {
        const at = now();
        // Row lock: concurrent holds on the same departure run one after another, so seats are never oversold.
        const [departure] = await tx.select().from(departures).where(eq(departures.id, input.departureId)).for("update");
        const listPrice = departure ? deps.tourPrice(departure.tourSlug) : null;
        if (!departure || listPrice === null || departure.status !== "open" || !isBookableDate(departure.date, at)) return { status: "unavailable" };

        await tx
          .update(bookings)
          .set({ status: "expired" })
          .where(and(eq(bookings.departureId, departure.id), eq(bookings.status, "held"), lte(bookings.holdExpiresAt, at)));
        const [row] = await tx
          .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
          .from(bookings)
          .where(and(eq(bookings.departureId, departure.id), inArray(bookings.status, ["held", "deposit_paid", "confirmed"])));

        const q = quote(departure.priceVnd ?? listPrice, input);
        const seatsLeft = departure.capacity - (row?.taken ?? 0);
        if (q.seats > seatsLeft) return { status: "sold_out", seatsLeft: Math.max(0, seatsLeft) };

        const code = newCode();
        await tx.insert(bookings).values({
          code,
          tokenHash: hashToken(token),
          departureId: departure.id,
          holdExpiresAt: new Date(at.getTime() + bookingRules.holdMinutes * 60_000),
          name: input.name,
          email: input.email,
          phone: input.phone,
          note: input.note,
          locale: input.locale,
          adults: input.adults,
          children: input.children,
          infants: input.infants,
          seats: q.seats,
          unitPriceVnd: q.unitPriceVnd,
          totalVnd: q.totalVnd,
          depositVnd: q.depositVnd,
        });
        return { status: "held", code, token };
      });
      if (result.status === "held") deps.logger.info("booking.held", { code: result.code });
      return result;
    },

    async getForGuest(code, token) {
      if (!CODE.test(code) || token.length < 20 || token.length > 64) return null;
      const [row] = await db
        .select({ b: bookings, d: departures })
        .from(bookings)
        .innerJoin(departures, eq(departures.id, bookings.departureId))
        .where(eq(bookings.code, code));
      if (!row || !timingSafeEqual(Buffer.from(row.b.tokenHash, "hex"), Buffer.from(hashToken(token), "hex"))) return null;
      const isExpired = row.b.status === "expired" || (row.b.status === "held" && row.b.holdExpiresAt <= now());
      return { ...row.b, departure: row.d, isExpired };
    },

    async expireStale() {
      const done = await db
        .update(bookings)
        .set({ status: "expired" })
        .where(and(eq(bookings.status, "held"), lte(bookings.holdExpiresAt, now())))
        .returning({ id: bookings.id });
      return done.length;
    },
  };
}
