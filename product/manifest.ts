import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { ProductContext, ProductJobs } from "@/core/product/context";
import type { Db } from "@/db/client";
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

  // Guests have no account: bookings are not part of a user's data export.
  const exporters: AccountDataExporter[] = [];
  const jobs: ProductJobs = {};

  return { services: { booking, deposits, paymentsSandbox: ctx.payments.vnpay?.sandbox ?? false }, exporters, jobs };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [];

/** Public product pages for sitemap.xml (paths without locale prefix). */
export const sitemapPaths: string[] = ["/tours", ...getTourCatalog().slugs().map((slug) => `/tours/${slug}`)];

/** Admin menu entries for product pages (e.g. "/admin/orders"); shown when the admin module is on. */
export const productAdminNav: ProductNavItem[] = [];

export type Product = ReturnType<typeof createProduct>;
