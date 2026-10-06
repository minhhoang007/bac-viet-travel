// Type only: rules run in the browser (booking form) and must not pull zod in.
import type { TourPricing } from "../tours/model";

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
  totalVnd: number;
  depositVnd: number;
}

export type Party = { adults: number; children: number; infants?: number; singleRooms?: number };

/** Child price = adult price × childPercent (rounded up to 1,000 VND); infants and single rooms at the tour's price. */
export function quote(unitPriceVnd: number, party: Party, pricing: TourPricing = DEFAULT_TOUR_PRICING): Quote {
  const childPriceVnd = roundUp1000((unitPriceVnd * pricing.childPercent) / 100);
  const infants = party.infants ?? 0;
  const singleRooms = pricing.singleSupplementVnd > 0 ? (party.singleRooms ?? 0) : 0;
  const totalVnd = party.adults * unitPriceVnd + party.children * childPriceVnd + infants * pricing.infantVnd + singleRooms * pricing.singleSupplementVnd;
  return {
    seats: party.adults + party.children,
    unitPriceVnd,
    childPriceVnd,
    infantPriceVnd: pricing.infantVnd,
    singleSupplementVnd: pricing.singleSupplementVnd,
    singleRooms,
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

/** Quote for a private tour: tier price per adult, the tour's child / infant / single room prices. */
export function privateQuote(pricing: PrivatePricing, party: Party, tourPricing: TourPricing = DEFAULT_TOUR_PRICING): Quote | null {
  const tier = privateTier(pricing, party.adults + party.children);
  return tier ? quote(tier.vnd, party, tourPricing) : null;
}

/** Today's date in Vietnam (UTC+7, no DST) as YYYY-MM-DD. */
export function vietnamToday(now: Date): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
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
