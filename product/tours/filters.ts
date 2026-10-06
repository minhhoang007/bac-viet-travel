import { DESTINATIONS, type Destination, type Tour } from "./model";

// Tour list filters, read from the URL (/tours?destination=sapa&duration=2&price=mid&type=private&sort=price-asc)
// so a filtered list can be shared. Unknown values are ignored, never an error.

export const DURATIONS = ["1", "2", "3+"] as const;
export const PRICE_BANDS = ["low", "mid", "high"] as const;
export const TOUR_TYPES = ["group", "private"] as const;
export const SORTS = ["popular", "price-asc", "price-desc", "duration"] as const;

export interface TourFilters {
  destination?: Destination;
  duration?: (typeof DURATIONS)[number];
  price?: (typeof PRICE_BANDS)[number];
  type?: (typeof TOUR_TYPES)[number];
  sort: (typeof SORTS)[number];
  /** Carried from the home search to the tour pages (departure choice), not a filter. */
  date?: string;
  guests?: number;
}

/** Price bands per currency: VND on Vietnamese pages, USD on English pages. */
export const PRICE_LIMITS = { vi: [1_500_000, 3_000_000], en: [60, 120] } as const;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const pick = <T extends string>(values: readonly T[], v: string | undefined) => (values as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

export function parseTourFilters(params: Params): TourFilters {
  const date = one(params.date);
  const guests = Number(one(params.guests));
  return {
    destination: pick(DESTINATIONS, one(params.destination)),
    duration: pick(DURATIONS, one(params.duration)),
    price: pick(PRICE_BANDS, one(params.price)),
    type: pick(TOUR_TYPES, one(params.type)),
    sort: pick(SORTS, one(params.sort)) ?? "popular",
    ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
    ...(Number.isInteger(guests) && guests >= 1 && guests <= 50 ? { guests } : {}),
  };
}

const priceOf = (tour: Tour, locale: "vi" | "en") => (locale === "vi" ? tour.price.vnd : tour.price.usd);

export function applyTourFilters(tours: Tour[], f: TourFilters, locale: "vi" | "en"): Tour[] {
  const [low, high] = PRICE_LIMITS[locale];
  const result = tours.filter(
    (t) =>
      (!f.destination || t.destination === f.destination) &&
      (!f.duration || (f.duration === "3+" ? t.days >= 3 : t.days === Number(f.duration))) &&
      (!f.price || (f.price === "low" ? priceOf(t, locale) < low : f.price === "mid" ? priceOf(t, locale) >= low && priceOf(t, locale) < high : priceOf(t, locale) >= high)) &&
      (!f.type || (f.type === "private" ? Boolean(t.private) : true)) &&
      (!f.guests || !t.private || f.type !== "private" || f.guests <= t.private.maxGuests),
  );
  const byOrder = (a: Tour, b: Tour) => Number(b.featured) - Number(a.featured) || a.order - b.order || a.title.localeCompare(b.title);
  const sorters: Record<TourFilters["sort"], (a: Tour, b: Tour) => number> = {
    popular: byOrder,
    "price-asc": (a, b) => priceOf(a, locale) - priceOf(b, locale) || byOrder(a, b),
    "price-desc": (a, b) => priceOf(b, locale) - priceOf(a, locale) || byOrder(a, b),
    duration: (a, b) => a.days - b.days || byOrder(a, b),
  };
  return [...result].sort(sorters[f.sort]);
}

/** Query string for a filter state (defaults left out), e.g. for links that keep the filters. */
export function tourFilterQuery(f: Partial<TourFilters>): string {
  const q = new URLSearchParams();
  for (const key of ["destination", "duration", "price", "type", "date", "guests"] as const) if (f[key] !== undefined) q.set(key, String(f[key]));
  if (f.sort && f.sort !== "popular") q.set("sort", f.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Number of narrowing filters in use (date, guests and sort are not filters). */
export const activeFilterCount = (f: TourFilters) => [f.destination, f.duration, f.price, f.type].filter(Boolean).length;
