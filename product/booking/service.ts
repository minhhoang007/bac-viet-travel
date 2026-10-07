import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import type { RateLimiter } from "@/core/security/rate-limit";
import type { Db } from "@/db/client";
import { bookings, departures, discountCodes, type Booking, type Departure } from "../schema/booking";
import type { Addon } from "../tours/model";
import { addDays, applyDiscount, bookingRules, DEFAULT_TOUR_PRICING, type Discount, isBookableDate, privateQuote, privateTier, quote, vietnamToday, type PrivatePricing, type TourPricing } from "./rules";
import { bookingInputSchema, discountCodeField, parseTravellers, privateBookingInputSchema } from "./validations";

export type BookingField = "departureId" | "tourSlug" | "date" | "name" | "email" | "phone" | "adults" | "children" | "infants" | "singleRooms" | "discountCode" | "note" | "agree";
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

export type SaveTravellersResult = { status: "saved" } | { status: "invalid"; errors: Record<string, "required" | "invalid" | "too_long"> } | { status: "not_found" } | { status: "locked" };

/** Whether the guest may still edit the traveller list: live booking, departure after the cutoff. */
export function travellersEditable(status: Booking["status"], isExpired: boolean, departureDate: string, now: Date): boolean {
  return (status === "held" ? !isExpired : status === "deposit_paid" || status === "confirmed") && isBookableDate(departureDate, now);
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
  /**
   * Private tour: the guest picks any bookable date and the group size; a private departure is created for this
   * booking alone (capacity = its seats), priced by the tour's private tiers, and held like a group booking.
   */
  holdPrivate(raw: Record<string, unknown>, clientKey: string): Promise<HoldResult>;
  /** Guest lookup: a wrong code or token both give null (indistinguishable). */
  getForGuest(code: string, token: string): Promise<BookingView | null>;
  /**
   * Live preview in the booking form: the discount a code gives on this tour and total today, or null. Rate limited
   * per visitor (`clientKey`) so codes cannot be found by trying many.
   */
  checkDiscount(code: string, tourSlug: string, totalVnd: number, clientKey: string): Promise<Discount | null>;
  /**
   * The guest's traveller list (D7): one row per person. Editable until the booking cutoff before departure, on
   * live bookings only (held, paid, confirmed).
   */
  saveTravellers(code: string, token: string, raw: Record<string, unknown>): Promise<SaveTravellersResult>;
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
  /** Adult list price of a tour (VND), null if the tour does not exist (async: tours come from the CMS). */
  tourPrice: (slug: string) => Promise<number | null>;
  /** Private tour pricing of a tour, null if it has none. */
  tourPrivate?: (slug: string) => Promise<PrivatePricing | null>;
  /** Prices by traveller type (child %, infant, single supplement); the defaults when absent. */
  tourPricing?: (slug: string) => Promise<TourPricing>;
  /** Limits discount previews per visitor (shared across server instances when Redis is configured). */
  discountLimiter?: RateLimiter;
  /** Add-ons the guest may choose on this tour (B6); none when absent. */
  tourAddons?: (slug: string) => Promise<Addon[]>;
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

  const view = async (d: Departure, taken: number, at: Date): Promise<DepartureView | null> => {
    const listPrice = await deps.tourPrice(d.tourSlug);
    if (listPrice === null) return null;
    const seatsLeft = Math.max(0, d.capacity - taken);
    return { ...d, seatsLeft, unitPriceVnd: d.priceVnd ?? listPrice, bookable: d.status === "open" && seatsLeft > 0 && isBookableDate(d.date, at) };
  };

  const invalid = (issues: { path: PropertyKey[]; message: string }[]): HoldResult => {
    const fieldErrors: Partial<Record<BookingField, BookingFieldError>> = {};
    for (const issue of issues) fieldErrors[issue.path[0] as BookingField] ??= FIELD_ERRORS.find((e) => e === issue.message) ?? "invalid";
    return { status: "invalid", fieldErrors };
  };

  type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
  type Party = { name: string; email: string; phone: string; note: string; locale: string; adults: number; children: number; infants: number; singleRooms: number; discountCode: string };

  /**
   * The discount a code gives on this tour and total today, or null (unknown, inactive, outside its dates, other
   * tour, total too low, used up). In a hold, the code row is locked so two guests never take its last use.
   */
  const findDiscount = async (q: Db | Tx, code: string, tourSlug: string, totalVnd: number, at: Date, lock: boolean): Promise<Discount | null> => {
    if (!code) return null;
    const query = q.select().from(discountCodes).where(eq(discountCodes.code, code));
    const [row] = lock ? await query.for("update") : await query;
    const today = vietnamToday(at);
    if (!row || !row.active || today < row.validFrom || today > row.validTo || (row.tourSlug && row.tourSlug !== tourSlug) || totalVnd < row.minTotalVnd) return null;
    if (row.maxUses !== null) {
      const [used] = await q
        .select({ n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(and(eq(bookings.discountCode, code), sql`(${bookings.status} in ('deposit_paid', 'confirmed') or (${bookings.status} = 'held' and ${bookings.holdExpiresAt} > ${at.toISOString()}))`));
      if ((used?.n ?? 0) >= row.maxUses) return null;
    }
    return { code: row.code, kind: row.kind, value: row.value };
  };
  const pricingOf = async (slug: string) => (await deps.tourPricing?.(slug)) ?? DEFAULT_TOUR_PRICING;
  const addonsOf = async (slug: string) => (await deps.tourAddons?.(slug)) ?? [];
  /** Quantities from the form fields addon_<id> (unknown ids and bad numbers ignored; quote() caps them). */
  const chosenAddons = (raw: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(raw)
        .filter(([k]) => /^addon_[a-z0-9-]{2,30}$/.test(k))
        .map(([k, v]) => [k.slice(6), Math.min(50, Math.max(0, Math.floor(Number(v)) || 0))]),
    );
  /** Single rooms only on tours with a supplement. */
  const singleRoomsAllowed = (input: Party, pricing: TourPricing) => input.singleRooms === 0 || pricing.singleSupplementVnd > 0;
  const insertHeld = async (tx: Tx, departureId: string, input: Party, q: ReturnType<typeof applyDiscount>, token: string, at: Date): Promise<HoldResult> => {
    const code = newCode();
    await tx.insert(bookings).values({
      code,
      tokenHash: hashToken(token),
      departureId,
      holdExpiresAt: new Date(at.getTime() + bookingRules.holdMinutes * 60_000),
      name: input.name,
      email: input.email,
      phone: input.phone,
      note: input.note,
      locale: input.locale,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      singleRooms: q.singleRooms,
      addons: q.addons.map((a) => ({ id: a.id, name: a.name, qty: a.qty, vnd: a.vnd })),
      discountCode: q.discountCode,
      discountVnd: q.discountVnd,
      seats: q.seats,
      unitPriceVnd: q.unitPriceVnd,
      totalVnd: q.totalVnd,
      depositVnd: q.depositVnd,
    });
    return { status: "held", code, token };
  };

  async function getForGuest(code: string, token: string): Promise<BookingView | null> {
    if (!CODE.test(code) || token.length < 20 || token.length > 64) return null;
    const [row] = await db
      .select({ b: bookings, d: departures })
      .from(bookings)
      .innerJoin(departures, eq(departures.id, bookings.departureId))
      .where(eq(bookings.code, code));
    if (!row || !timingSafeEqual(Buffer.from(row.b.tokenHash, "hex"), Buffer.from(hashToken(token), "hex"))) return null;
    const isExpired = row.b.status === "expired" || (row.b.status === "held" && row.b.holdExpiresAt <= now());
    return { ...row.b, departure: row.d, isExpired };
  }

  return {
    async listDepartures(tourSlug) {
      const at = now();
      const today = vietnamToday(at);
      const rows = await db
        .select({ d: departures, taken: takenSql(at) })
        .from(departures)
        .where(and(eq(departures.tourSlug, tourSlug), eq(departures.kind, "group"), gte(departures.date, today), lte(departures.date, addDays(today, 366))))
        .orderBy(asc(departures.date));
      return (await Promise.all(rows.map((r) => view(r.d, r.taken, at)))).filter((v) => v !== null);
    },

    async getDeparture(id) {
      if (!UUID.test(id)) return null;
      const at = now();
      const [row] = await db.select({ d: departures, taken: takenSql(at) }).from(departures).where(and(eq(departures.id, id), eq(departures.kind, "group")));
      return row ? await view(row.d, row.taken, at) : null;
    },

    async hold(raw, clientKey) {
      // Honeypot: answer like a rate limit, without touching the database.
      if (typeof raw.website === "string" && raw.website.length > 0) {
        deps.logger.warn("booking.honeypot");
        return { status: "rate_limited" };
      }
      const parsed = bookingInputSchema.safeParse(raw);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (!(await deps.rateLimiter.limit(clientKey)).success) return { status: "rate_limited" };
      const input = parsed.data;
      const token = randomBytes(24).toString("base64url");

      const result = await db.transaction(async (tx): Promise<HoldResult> => {
        const at = now();
        let pricing = DEFAULT_TOUR_PRICING;
        // Row lock: concurrent holds on the same departure run one after another, so seats are never oversold.
        const [departure] = await tx.select().from(departures).where(eq(departures.id, input.departureId)).for("update");
        const listPrice = departure ? await deps.tourPrice(departure.tourSlug) : null;
        if (!departure || departure.kind !== "group" || listPrice === null || departure.status !== "open" || !isBookableDate(departure.date, at)) return { status: "unavailable" };
        pricing = await pricingOf(departure.tourSlug);
        if (!singleRoomsAllowed(input, pricing)) return { status: "invalid", fieldErrors: { singleRooms: "invalid" } };

        await tx
          .update(bookings)
          .set({ status: "expired" })
          .where(and(eq(bookings.departureId, departure.id), eq(bookings.status, "held"), lte(bookings.holdExpiresAt, at)));
        const [row] = await tx
          .select({ taken: sql<number>`coalesce(sum(${bookings.seats}), 0)::int` })
          .from(bookings)
          .where(and(eq(bookings.departureId, departure.id), inArray(bookings.status, ["held", "deposit_paid", "confirmed"])));

        const base = quote(departure.priceVnd ?? listPrice, { ...input, addons: chosenAddons(raw) }, pricing, await addonsOf(departure.tourSlug));
        const seatsLeft = departure.capacity - (row?.taken ?? 0);
        if (base.seats > seatsLeft) return { status: "sold_out", seatsLeft: Math.max(0, seatsLeft) };
        const discount = await findDiscount(tx, input.discountCode, departure.tourSlug, base.totalVnd, at, true);
        if (input.discountCode && !discount) return { status: "invalid", fieldErrors: { discountCode: "invalid" } };
        const q = applyDiscount(base, discount);

        return insertHeld(tx, departure.id, input, q, token, at);
      });
      if (result.status === "held") deps.logger.info("booking.held", { code: result.code });
      return result;
    },

    async holdPrivate(raw, clientKey) {
      if (typeof raw.website === "string" && raw.website.length > 0) {
        deps.logger.warn("booking.honeypot");
        return { status: "rate_limited" };
      }
      const parsed = privateBookingInputSchema.safeParse(raw);
      if (!parsed.success) return invalid(parsed.error.issues);
      const input = parsed.data;
      const at = now();
      const pricing = (await deps.tourPrivate?.(input.tourSlug)) ?? null;
      if (!pricing || (await deps.tourPrice(input.tourSlug)) === null) return { status: "unavailable" };
      if (!isBookableDate(input.date, at) || input.date > addDays(vietnamToday(at), 366)) return { status: "invalid", fieldErrors: { date: "invalid" } };
      const tourPricing = await pricingOf(input.tourSlug);
      if (!singleRoomsAllowed(input, tourPricing)) return { status: "invalid", fieldErrors: { singleRooms: "invalid" } };
      const q = privateQuote(pricing, { ...input, addons: chosenAddons(raw) }, tourPricing, await addonsOf(input.tourSlug));
      if (!q) return { status: "invalid", fieldErrors: { adults: input.adults + input.children > pricing.maxGuests ? "too_many" : "invalid" } };
      if (!(await deps.rateLimiter.limit(clientKey)).success) return { status: "rate_limited" };
      const token = randomBytes(24).toString("base64url");

      const result = await db.transaction(async (tx): Promise<HoldResult> => {
        const discount = await findDiscount(tx, input.discountCode, input.tourSlug, q.totalVnd, at, true);
        if (input.discountCode && !discount) return { status: "invalid", fieldErrors: { discountCode: "invalid" } };
        const [departure] = await tx
          .insert(departures)
          .values({ tourSlug: input.tourSlug, date: input.date, capacity: q.seats, priceVnd: privateTier(pricing, q.seats)!.vnd, kind: "private" })
          .returning({ id: departures.id });
        return insertHeld(tx, departure!.id, input, applyDiscount(q, discount), token, at);
      });
      if (result.status === "held") deps.logger.info("booking.held_private", { code: result.code });
      return result;
    },

    getForGuest,

    async checkDiscount(code, tourSlug, totalVnd, clientKey) {
      if (deps.discountLimiter && !(await deps.discountLimiter.limit(`discount:${clientKey}`)).success) return null;
      const parsed = discountCodeField.safeParse(code);
      return parsed.success ? findDiscount(db, parsed.data, tourSlug, totalVnd, now(), false) : null;
    },

    async saveTravellers(code, token, raw) {
      const booking = await getForGuest(code, token);
      if (!booking) return { status: "not_found" };
      const at = now();
      if (!travellersEditable(booking.status, booking.isExpired, booking.departure.date, at)) return { status: "locked" };
      const parsed = parseTravellers(raw, booking.adults + booking.children + booking.infants, Number(vietnamToday(at).slice(0, 4)));
      if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
      await db.update(bookings).set({ travellers: parsed.travellers }).where(eq(bookings.id, booking.id));
      deps.logger.info("booking.travellers_saved", { code: booking.code, count: parsed.travellers.length });
      return { status: "saved" };
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
