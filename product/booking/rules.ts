// Type only: rules run in the browser (booking form) and must not pull zod in.
import type { Addon, TourPricing } from "../tours/model";

/** Booking rules (Phase 1 defaults approved by the owner). Pure functions: no DB, no clock. */
export const bookingRules = {
  depositRate: 0.3,
  maxSeatsPerBooking: 10,
  maxInfants: 4,
  /** Departures must be at least this many days after today (Vietnam time). */
  cutoffDays: 2,
  holdMinutes: 15,
  defaultCapacity: 16,
} as const;

const roundUp1000 = (n: number) => Math.ceil(n / 1000) * 1000;

export type { TourPricing };
/** Prices by traveller type when a tour sets none (tourPricingSchema defaults): children 75%, infants free, no single supplement. */
export const DEFAULT_TOUR_PRICING: TourPricing = { childPercent: 75, infantVnd: 0, singleSupplementVnd: 0 };

export interface Quote {
  seats: number;
  unitPriceVnd: number;
  childPriceVnd: number;
  infantPriceVnd: number;
  /** Per single room (whole tour); 0 = not offered. */
  singleSupplementVnd: number;
  singleRooms: number;
  /** Chosen add-ons with their quantity and line price (B6). */
  addons: { id: string; name: Addon["name"]; qty: number; vnd: number }[];
  totalVnd: number;
  depositVnd: number;
}

export type Party = { adults: number; children: number; infants?: number; singleRooms?: number; addons?: Record<string, number> };

/** Chosen add-ons priced: per-person ones capped at the number of travellers (adults + children), others at one. */
function priceAddons(available: readonly Addon[], party: Party): Quote["addons"] {
  const travellers = party.adults + party.children;
  return available
    .map((a) => {
      const wanted = Math.max(0, Math.floor(party.addons?.[a.id] ?? 0));
      const qty = Math.min(wanted, a.per === "person" ? travellers : 1);
      return { id: a.id, name: a.name, qty, vnd: qty * a.vnd };
    })
    .filter((a) => a.qty > 0);
}

/** Child price = adult price × childPercent (rounded up to 1,000 VND); infants and single rooms at the tour's price. */
export function quote(unitPriceVnd: number, party: Party, pricing: TourPricing = DEFAULT_TOUR_PRICING, available: readonly Addon[] = []): Quote {
  const childPriceVnd = roundUp1000((unitPriceVnd * pricing.childPercent) / 100);
  const infants = party.infants ?? 0;
  const singleRooms = pricing.singleSupplementVnd > 0 ? (party.singleRooms ?? 0) : 0;
  const addons = priceAddons(available, party);
  const totalVnd = party.adults * unitPriceVnd + party.children * childPriceVnd + infants * pricing.infantVnd + singleRooms * pricing.singleSupplementVnd + addons.reduce((n, a) => n + a.vnd, 0);
  return {
    seats: party.adults + party.children,
    unitPriceVnd,
    childPriceVnd,
    infantPriceVnd: pricing.infantVnd,
    singleSupplementVnd: pricing.singleSupplementVnd,
    singleRooms,
    addons,
    totalVnd,
    depositVnd: roundUp1000(totalVnd * bookingRules.depositRate),
  };
}

/** Private tour price per person by group size: the tier with the largest minGuests ≤ guests applies. */
export interface PrivatePricing {
  tiers: readonly { minGuests: number; vnd: number; usd: number }[];
  maxGuests: number;
}

/** Tier for this many guests (adults + children), or null outside [first tier, maxGuests]. */
export function privateTier(pricing: PrivatePricing, guests: number) {
  if (guests > pricing.maxGuests) return null;
  return [...pricing.tiers].reverse().find((t) => guests >= t.minGuests) ?? null;
}

/** A discount as the quote needs it (D6). */
export type Discount = { code: string; kind: "percent" | "amount"; value: number };

/** The quote with a discount taken off the total (at most 90%), deposit recomputed on the new total. */
export function applyDiscount(q: Quote, discount: Discount | null): Quote & { discountVnd: number; discountCode: string | null } {
  if (!discount) return { ...q, discountVnd: 0, discountCode: null };
  // At most 90% off (as percent codes): a deposit is still paid, so VNPay and the hold rules keep working.
  const off = Math.min(Math.floor((q.totalVnd * 0.9) / 1000) * 1000, discount.kind === "percent" ? roundUp1000((q.totalVnd * discount.value) / 100) : discount.value);
  const totalVnd = q.totalVnd - off;
  return { ...q, totalVnd, depositVnd: roundUp1000(totalVnd * bookingRules.depositRate), discountVnd: off, discountCode: discount.code };
}

/** Quote for a private tour: tier price per adult, the tour's child / infant / single room prices. */
export function privateQuote(pricing: PrivatePricing, party: Party, tourPricing: TourPricing = DEFAULT_TOUR_PRICING, available: readonly Addon[] = []): Quote | null {
  const tier = privateTier(pricing, party.adults + party.children);
  return tier ? quote(tier.vnd, party, tourPricing, available) : null;
}

/** Vietnam is UTC+7 all year (no DST). */
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** Today's date in Vietnam as YYYY-MM-DD. */
export function vietnamToday(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant a Vietnam day (YYYY-MM-DD) begins. */
export function vietnamDayStart(day: string): Date {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - VIETNAM_OFFSET_MS);
}

/** One kind per person, in party order: adults, then children, then infants. */
export function travellerKinds(party: { adults: number; children: number; infants: number }): ("adult" | "child" | "infant")[] {
  return [...Array<"adult">(party.adults).fill("adult"), ...Array<"child">(party.children).fill("child"), ...Array<"infant">(party.infants).fill("infant")];
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Bookable = open and not inside the cutoff window. */
export function isBookableDate(day: string, now: Date): boolean {
  return day >= addDays(vietnamToday(now), bookingRules.cutoffDays);
}
