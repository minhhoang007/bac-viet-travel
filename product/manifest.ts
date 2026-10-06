import { revalidateTag, unstable_cache } from "next/cache";
import { getEnv } from "@/bootstrap/env";
import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { ContentTypeDefinition, ProductContext, ProductJobs, SitemapContext } from "@/core/product/context";
import { tourSource } from "@/config/tours";
import type { Db } from "@/db/client";
import { createBookingAdmin } from "./booking/admin";
import { createDepositService } from "./booking/deposits";
import { createFeedbackService } from "./booking/feedback";
import { createDiscountAdmin } from "./booking/discounts";
import { DEFAULT_TOUR_PRICING } from "./booking/rules";
import { bankTransferConfig } from "@/config/bank-transfer";
import { createBookingService } from "./booking/service";
import { DESTINATIONS, getTourCatalog } from "./tours/catalog";
import { tourProblems } from "./tours/document";
import { createTourSource, TOUR_CONTENT_TYPE, TOURS_CACHE_TAG } from "./tours/source";

/** The only file bootstrap/ imports from product/. Declares product services, menu, exporters and jobs. */
export function createProduct(db: Db, ctx: ProductContext) {
  // Published tours (CMS) or the MDX files (config/tours.ts). Cached for an hour and on every publish (onChange).
  const tours = createTourSource({
    listPublished: tourSource === "content" ? ctx.content?.listPublished : undefined,
    listMoved: ctx.content?.listMoved,
    cache: (key, load) => unstable_cache(load, [key], { tags: [TOURS_CACHE_TAG], revalidate: 3600 }),
    fallback: getTourCatalog,
    logger: ctx.logger,
  });
  const tour = async (slug: string, locale = "vi") => {
    const catalog = await tours.catalog();
    return catalog.get(locale, slug) ?? catalog.get("vi", slug);
  };
  const tourTitle = async (slug: string, locale: string) => (await tour(slug, locale))?.title ?? slug;

  const booking = createBookingService({
    db,
    logger: ctx.logger,
    rateLimiter: ctx.rateLimiter("booking-hold", { max: 10, windowMs: 10 * 60_000 }),
    tourPrice: async (slug) => (await tour(slug))?.price.vnd ?? null,
    tourPrivate: async (slug) => (await tour(slug))?.private ?? null,
    tourPricing: async (slug) => ({ ...DEFAULT_TOUR_PRICING, ...(await tour(slug))?.pricing }),
    tourAddons: async (slug) => (await tour(slug))?.addons ?? [],
    now: ctx.now,
  });
  const deposits = createDepositService({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    bookings: booking,
    vnpay: ctx.payments.vnpay,
    transferHoldMinutes: bankTransferConfig.holdMinutes,
    tourTitle,
    now: ctx.now,
  });

  const bookingAdmin = createBookingAdmin({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    audit: ctx.audit,
    tourTitle,
    tourExists: async (slug) => (await tour(slug)) !== null,
    receiveTransfer: (code, input) => {
      const env = getEnv();
      return deposits.receiveTransfer(code, input, { siteUrl: env.NEXT_PUBLIC_SITE_URL, teamEmail: env.extra.CONTACT_TO_EMAIL });
    },
    now: ctx.now,
  });

  // Post-trip feedback (E4): links signed with the auth secret (server-only, already required in profile app).
  const feedback = createFeedbackService({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    secret: () => getEnv().extra.BETTER_AUTH_SECRET ?? "",
    siteUrl: () => getEnv().NEXT_PUBLIC_SITE_URL,
    tourTitle,
    now: ctx.now,
  });

  // Guests have no account: bookings are not part of a user's data export.
  const exporters: AccountDataExporter[] = [];
  // Run on every jobs tick (Vercel Cron, daily): reminder emails, tidy expired holds.
  const jobs: ProductJobs = {
    periodic: {
      "booking.reminders": async () => void (await bookingAdmin.sendReminders()),
      "booking.feedback_requests": async () => void (await feedback.sendRequests()),
      // Ask VNPay first: a paid deposit whose IPN was lost must not expire with its hold.
      "booking.expire_holds": async () => {
        const env = getEnv();
        await deposits.reconcile({ siteUrl: env.NEXT_PUBLIC_SITE_URL, teamEmail: env.extra.CONTACT_TO_EMAIL });
        await booking.expireStale();
      },
    },
  };

  const discounts = createDiscountAdmin({ db, audit: ctx.audit, now: ctx.now });
  return { services: { tours, booking, deposits, bookingAdmin, feedback, discounts, paymentsSandbox: ctx.payments.vnpay?.sandbox ?? false }, exporters, jobs };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
  /** productAdminNav only: roles besides admin that see the entry, e.g. ["editor"] for content pages. */
  roles?: readonly ("editor" | "admin")[];
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [];

/** Public product pages for sitemap.xml (paths without locale prefix): fixed pages and every published tour. */
export async function sitemapPaths({ content }: SitemapContext): Promise<string[]> {
  const slugs =
    tourSource === "content" && content
      ? (await content.listPublished(TOUR_CONTENT_TYPE)).map((t) => t.slug)
      : getTourCatalog().slugs();
  return ["/about", "/contact", "/cancellation", "/payment", "/tours", ...DESTINATIONS.map((d) => `/tours/${d}`), ...slugs.map((slug) => `/tours/${slug}`)];
}

/** Admin menu entries (starter rc.11). */
export const productAdminNav: ProductNavItem[] = [
  // Content: marketing (editor role) writes tours; publishing stays with admins (content workflow).
  { href: "/admin/tours", label: { vi: "Tour", en: "Tours" }, roles: ["editor"] },
  { href: "/admin/bookings", label: { vi: "Đơn đặt tour", en: "Bookings" } },
  { href: "/admin/discounts", label: { vi: "Mã giảm giá", en: "Discount codes" } },
  { href: "/admin/departures", label: { vi: "Lịch khởi hành", en: "Departures" } },
];

export type Product = ReturnType<typeof createProduct>;

/** Staff-edited content types (content module, starter ADR-0009). */
export const contentTypes: Record<string, ContentTypeDefinition> = {
  tour: {
    label: { vi: "Tour", en: "Tour" },
    adminPath: (id) => `/admin/tours/${id}`,
    publicPath: (slug) => `/tours/${slug}`,
    // A tour can be submitted and published only when complete (both languages, prices, images).
    validate: tourProblems,
    // Expire at once: static pages (home) regenerate from fresh tours on the next visit.
    onChange: () => revalidateTag(TOURS_CACHE_TAG, { expire: 0 }),
  },
};
