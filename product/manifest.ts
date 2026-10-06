import { revalidateTag } from "next/cache";
import { getEnv } from "@/bootstrap/env";
import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { ContentTypeDefinition, ProductContext, ProductJobs } from "@/core/product/context";
import type { Db } from "@/db/client";
import { createBookingAdmin } from "./booking/admin";
import { createDepositService } from "./booking/deposits";
import { createBookingService } from "./booking/service";
import { getTourCatalog } from "./tours/catalog";

/** The only file bootstrap/ imports from product/. Declares product services, menu, exporters and jobs. */
export function createProduct(db: Db, ctx: ProductContext) {
  const catalog = getTourCatalog();
  const booking = createBookingService({
    db,
    logger: ctx.logger,
    rateLimiter: ctx.rateLimiter("booking-hold", { max: 10, windowMs: 10 * 60_000 }),
    tourPrice: (slug) => catalog.get("vi", slug)?.price.vnd ?? null,
    tourPrivate: (slug) => catalog.get("vi", slug)?.private ?? null,
    now: ctx.now,
  });
  const deposits = createDepositService({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    bookings: booking,
    vnpay: ctx.payments.vnpay,
    tourTitle: (slug, locale) => catalog.get(locale, slug)?.title ?? catalog.get("vi", slug)?.title ?? slug,
    now: ctx.now,
  });

  const bookingAdmin = createBookingAdmin({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    audit: ctx.audit,
    tourTitle: (slug, locale) => catalog.get(locale, slug)?.title ?? catalog.get("vi", slug)?.title ?? slug,
    tourExists: (slug) => catalog.get("vi", slug) !== null,
    now: ctx.now,
  });

  // Guests have no account: bookings are not part of a user's data export.
  const exporters: AccountDataExporter[] = [];
  // Run on every jobs tick (Vercel Cron, daily): reminder emails, tidy expired holds.
  const jobs: ProductJobs = {
    periodic: {
      "booking.reminders": async () => void (await bookingAdmin.sendReminders()),
      // Ask VNPay first: a paid deposit whose IPN was lost must not expire with its hold.
      "booking.expire_holds": async () => {
        const env = getEnv();
        await deposits.reconcile({ siteUrl: env.NEXT_PUBLIC_SITE_URL, teamEmail: env.extra.CONTACT_TO_EMAIL });
        await booking.expireStale();
      },
    },
  };

  return { services: { booking, deposits, bookingAdmin, paymentsSandbox: ctx.payments.vnpay?.sandbox ?? false }, exporters, jobs };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
  /** productAdminNav only: roles besides admin that see the entry, e.g. ["editor"] for content pages. */
  roles?: readonly ("editor" | "admin")[];
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [];

/** Public product pages for sitemap.xml (paths without locale prefix). */
export const sitemapPaths: string[] = ["/about", "/cancellation", "/payment", "/tours", ...getTourCatalog().slugs().map((slug) => `/tours/${slug}`)];

/** Admin menu entries (starter rc.11). */
export const productAdminNav: ProductNavItem[] = [
  { href: "/admin/bookings", label: { vi: "Đơn đặt tour", en: "Bookings" } },
  { href: "/admin/departures", label: { vi: "Lịch khởi hành", en: "Departures" } },
];

export type Product = ReturnType<typeof createProduct>;

/** Cache tag of every page reading published tours (P2): revalidated whenever a tour is published, hidden or shown. */
export const TOURS_CACHE_TAG = "tours";

/** Staff-edited content types (content module, starter ADR-0009). */
export const contentTypes: Record<string, ContentTypeDefinition> = {
  tour: {
    label: { vi: "Tour", en: "Tour" },
    adminPath: (id) => `/admin/tours/${id}`,
    publicPath: (slug) => `/tours/${slug}`,
    onChange: () => revalidateTag(TOURS_CACHE_TAG, "max"),
  },
};
