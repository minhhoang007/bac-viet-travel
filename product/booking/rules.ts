/** Booking rules (Phase 1 defaults approved by the owner). Pure functions: no DB, no clock. */
export const bookingRules = {
  depositRate: 0.3,
  childRate: 0.75,
  maxSeatsPerBooking: 10,
  maxInfants: 4,
  /** Departures must be at least this many days after today (Vietnam time). */
  cutoffDays: 2,
  holdMinutes: 15,
  defaultCapacity: 16,
} as const;

const roundUp1000 = (n: number) => Math.ceil(n / 1000) * 1000;

export interface Quote {
  seats: number;
  unitPriceVnd: number;
  childPriceVnd: number;
  totalVnd: number;
  depositVnd: number;
}

export function quote(unitPriceVnd: number, party: { adults: number; children: number }): Quote {
  const childPriceVnd = roundUp1000(unitPriceVnd * bookingRules.childRate);
  const totalVnd = party.adults * unitPriceVnd + party.children * childPriceVnd;
  return { seats: party.adults + party.children, unitPriceVnd, childPriceVnd, totalVnd, depositVnd: roundUp1000(totalVnd * bookingRules.depositRate) };
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

/** Quote for a private tour: tier price per adult, children at the usual child rate. */
export function privateQuote(pricing: PrivatePricing, party: { adults: number; children: number }): Quote | null {
  const tier = privateTier(pricing, party.adults + party.children);
  return tier ? quote(tier.vnd, party) : null;
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
