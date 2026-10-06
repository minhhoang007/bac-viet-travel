import type { Locale } from "@/config/app";
import type { Tour } from "./catalog";

/**
 * A VND amount (a departure's price, a supplement…) in the page currency: VND on Vietnamese pages, USD on English
 * pages at the tour's own VND/USD ratio.
 */
export function formatAmount(vnd: number, tourPrice: Tour["price"], locale: Locale): string {
  return formatPrice({ price: { vnd, usd: Math.round((tourPrice.usd * vnd) / tourPrice.vnd) } }, locale);
}

/** Vietnamese pages show VND, English pages USD. */
export function formatPrice(tour: Pick<Tour, "price">, locale: Locale): string {
  return locale === "vi"
    ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(tour.price.vnd)
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(tour.price.usd);
}
