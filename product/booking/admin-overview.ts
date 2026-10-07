import type { Locale } from "@/config/app";
import type { ProductStat } from "@/core/product/context";
import type { BookingAdmin } from "./admin";
import { getBookingAdminContent } from "./admin-content";
import { formatVnd } from "./content";

/** Booking figures shown first on /admin (manifest `adminOverview`); each opens the matching list. */
export function bookingOverview(bookingAdmin: Pick<BookingAdmin, "stats">) {
  return async (locale: Locale): Promise<ProductStat[]> => {
    const s = await bookingAdmin.stats();
    const c = getBookingAdminContent(locale).stats;
    return [
      { label: c.attention, value: s.attention, href: "/admin/bookings?filter=attention" },
      { label: c.paidToday, value: s.paidToday, href: "/admin/bookings?filter=all" },
      { label: c.depositsWeek, value: formatVnd(s.depositsWeekVnd, locale), href: "/admin/reports" },
      { label: c.upcoming, value: s.upcoming.length, href: "/admin/departures" },
    ];
  };
}
