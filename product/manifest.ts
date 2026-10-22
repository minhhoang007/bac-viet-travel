import { revalidateTag, unstable_cache } from "next/cache";
import { getEnv } from "@/bootstrap/env";
import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { ContentTypeDefinition, ProductContext, ProductJobs, SitemapContext } from "@/core/product/context";
import { tourSource } from "@/config/tours";
import type { Db } from "@/db/client";
import { createBookingAdmin } from "./booking/admin";
import { bookingOverview } from "./booking/admin-overview";
import { createDepositService } from "./booking/deposits";
import { createFeedbackService } from "./booking/feedback";
import { createDiscountAdmin } from "./booking/discounts";
import { createDashboard } from "./booking/dashboard";
import { createReports } from "./booking/reports";
import { followTourMoves } from "./booking/tour-moves";
import { DEFAULT_TOUR_PRICING } from "./booking/rules";
import { defaultBankTransfer } from "@/config/bank-transfer";
import { createBookingService } from "./booking/service";
import { DESTINATIONS, getTourCatalog } from "./tours/catalog";
import { tourProblems } from "./tours/document";
import { createInquiryService } from "./tours/inquiry";
import { can, type Permission, type StaffRole } from "./staff/permissions";
import { createStaffService } from "./staff/service";
import { createThemeService } from "./theme/service";
import { createCompanyService } from "./company/service";
import { createTourSource, TOUR_CONTENT_TYPE, TOURS_CACHE_TAG } from "./tours/source";

/**
 * Set by createProduct: departures and discount codes follow a renamed tour (booking/tour-moves.ts). Module state
 * because contentTypes below is static and its onChange gets no database; the container builds the product once.
 */
let followTourSlugs: (() => Promise<void>) | undefined;

/** The only file bootstrap/ imports from product/. Declares product services, menu, exporters and jobs. */
export function createProduct(db: Db, ctx: ProductContext) {
  const content = ctx.content;
  followTourSlugs = content
    ? async () => {
        const live = new Set((await content.listPublished(TOUR_CONTENT_TYPE)).map((t) => t.slug));
        const moved = await followTourMoves(db, await content.listMoved(TOUR_CONTENT_TYPE), live);
        if (moved) ctx.logger.info("tours.slug_followed", { moved });
      }
    : undefined;
  // Published tours (CMS) or the MDX files (config/tours.ts). Cached for an hour and on every publish (onChange).
  const tours = createTourSource({
    listPublished: tourSource === "content" ? ctx.content?.listPublished : undefined,
    listMoved: ctx.content?.listMoved,
    cache: (key, load) => unstable_cache(load, [key], { tags: [TOURS_CACHE_TAG], revalidate: 3600 }),
    fallback: getTourCatalog,
    imageSrc: ctx.media?.imageSrc,
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
    tourSnapshot: async (slug, locale) => {
      const t = await tour(slug, locale);
      return t ? { title: t.title, pickup: t.pickupTime || null } : null;
    },
    discountLimiter: ctx.rateLimiter("booking:discount-preview", { max: 20, windowMs: 10 * 60_000 }),
    // A visitor holds one date at most 3 times an hour (a guest rarely needs a second try).
    departureLimiter: ctx.rateLimiter("booking-hold:departure", { max: 3, windowMs: 60 * 60_000 }),
    // Lost links: 5 requests an hour per visitor and per booking.
    mail: ctx.mail,
    linkLimiter: ctx.rateLimiter("booking-link", { max: 5, windowMs: 60 * 60_000 }),
    now: ctx.now,
  });
  const deposits = createDepositService({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    bookings: booking,
    vnpay: ctx.payments.vnpay,
    transferHoldMinutes: defaultBankTransfer.holdMinutes,
    tourTitle,
    // A guest retrying a failed card payment needs a few tries; 10 in 30 minutes is far beyond that.
    payLimiter: ctx.rateLimiter("booking-pay", { max: 10, windowMs: 30 * 60_000 }),
    now: ctx.now,
  });

  const bookingAdmin = createBookingAdmin({
    db,
    logger: ctx.logger,
    mail: ctx.mail,
    audit: ctx.audit,
    tourTitle,
    tourExists: async (slug) => (await tour(slug)) !== null,
    tourPickup: async (slug, locale) => (await tour(slug, locale))?.pickupTime || null,
    tourPrice: async (slug) => (await tour(slug))?.price.vnd ?? null,
    receiveTransfer: (tx, code, input) => {
      const env = getEnv();
      return deposits.receiveTransferIn(tx, code, input, { siteUrl: env.NEXT_PUBLIC_SITE_URL, teamEmail: env.extra.CONTACT_TO_EMAIL });
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
    tourDays: async (slug) => (await tour(slug))?.days ?? 1,
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
      // Payment emails that were never sent (the process stopped right after recording the money).
      "booking.payment_emails": async () => {
        const env = getEnv();
        await deposits.sendMissedEmails({ siteUrl: env.NEXT_PUBLIC_SITE_URL, teamEmail: env.extra.CONTACT_TO_EMAIL });
      },
      "booking.purge_abandoned": async () => {
        await deposits.purgeLinkTokens();
        await booking.purgeAbandoned();
      },
    },
  };

  const discounts = createDiscountAdmin({ db, audit: ctx.audit, now: ctx.now });
  const staff = createStaffService({ db, audit: ctx.audit });
  roleLookup = staff.roleOf;
  const theme = createThemeService({ db, audit: ctx.audit });
  const company = createCompanyService({ db, audit: ctx.audit });
  const reports = createReports({ db });
  const dashboard = createDashboard({ db, now: ctx.now });
  // Tour enquiry form: shared limiter (Redis when configured), like the starter contact form; the action checks
  // that the email module is on before using it.
  const inquiry = createInquiryService({
    mail: ctx.mail,
    logger: ctx.logger,
    rateLimiter: ctx.rateLimiter("tour-inquiry", { max: 5, windowMs: 10 * 60_000 }),
    to: () => getEnv().extra.CONTACT_TO_EMAIL ?? "",
    tourTitles: async (locale) => (await tours.catalog()).list(locale).map((t) => t.title),
  });
  return { adminOverview: bookingOverview(bookingAdmin), services: { tours, booking, deposits, bookingAdmin, feedback, discounts, reports, dashboard, inquiry, staff, theme, company, paymentsSandbox: ctx.payments.vnpay?.sandbox ?? false }, exporters, jobs };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
  /** productAdminNav only: roles besides admin that see the entry, e.g. ["editor"] for content pages. */
  roles?: readonly ("editor" | "admin")[];
  /** productAdminNav only: narrows `roles` per user (starter v1.15): here, the staff permission of the page. */
  allow?: (user: { id: string; role: "user" | "editor" | "admin" }) => boolean | Promise<boolean>;
  /** productAdminNav only: menu section. "main" (default): the business pages at the top; "content"; "settings". */
  group?: "main" | "content" | "settings";
}

/**
 * Staff role lookup for the admin menu, set by createProduct (which runs when bootstrap builds the container, before
 * any admin page renders): the menu entries below cannot import the container without an import cycle.
 */
let roleLookup: ((userId: string) => Promise<StaffRole | null>) | null = null;
const staffRoleOf = async (userId: string): Promise<StaffRole | null> => (roleLookup ? roleLookup(userId) : null);
const staffMay = (permission: Permission) => async (user: { id: string; role: string }) => can(user, await staffRoleOf(user.id), permission);
/** Whether a signed-in user holds a staff permission (admins: always), for checks outside the menu. */
export const staffCan = (user: { id: string; role: string }, permission: Permission) => staffMay(permission)(user);

/** Images used by any content cannot be deleted from the library (read by bootstrap for the media module). */
export { mediaInUse } from "./media/service";

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [];

/** Public product pages for sitemap.xml (paths without locale prefix): fixed pages and every published tour. */
export async function sitemapPaths({ content }: SitemapContext): Promise<string[]> {
  const slugs =
    tourSource === "content" && content
      ? (await content.listPublished(TOUR_CONTENT_TYPE)).map((t) => t.slug)
      : getTourCatalog().slugs();
  return ["/about", "/contact", "/faq", "/cancellation", "/payment", "/tours", ...DESTINATIONS.map((d) => `/tours/${d}`), ...slugs.map((slug) => `/tours/${slug}`)];
}

/** Admin menu entries (starter rc.11). */
export const productAdminNav: ProductNavItem[] = [
  // Selling (first menu section): editors with a staff role (H2); each page checks the same permission (app/_lib/staff.ts).
  { href: "/admin/bookings", label: { vi: "Đơn đặt tour", en: "Bookings" }, roles: ["editor"], allow: staffMay("bookings.view") },
  { href: "/admin/departures", label: { vi: "Lịch khởi hành", en: "Departures" }, roles: ["editor"], allow: staffMay("departures") },
  { href: "/admin/discounts", label: { vi: "Mã giảm giá", en: "Discount codes" }, roles: ["editor"], allow: staffMay("discounts") },
  { href: "/admin/reports", label: { vi: "Báo cáo", en: "Reports" }, roles: ["editor"], allow: staffMay("reports") },
  // Content: marketing (editor role) writes tours; publishing stays with admins (content workflow).
  // Sales staff do bookings only, not tour content. Blog posts and images stay open to every editor, sales included
  // (owner's choice 2026-10-22: sales do marketing too); publishing stays with admins.
  { href: "/admin/tours", label: { vi: "Tour", en: "Tours" }, roles: ["editor"], allow: async (u) => (await staffRoleOf(u.id)) !== "sale", group: "content" },
  { href: "/admin/staff", label: { vi: "Nhân viên", en: "Staff" }, group: "settings" },
  { href: "/admin/company", label: { vi: "Thông tin công ty", en: "Company details" }, group: "settings" },
  { href: "/admin/appearance", label: { vi: "Giao diện", en: "Appearance" }, group: "settings" },
];

export type Product = ReturnType<typeof createProduct>;

/** Staff-edited content types (content module, starter ADR-0009). */
export const contentTypes: Record<string, ContentTypeDefinition> = {
  tour: {
    label: { vi: "Tour", en: "Tour" },
    adminPath: (id) => `/admin/tours/${id}`,
    publicPath: (slug) => `/tours/${slug}`,
    // Sales staff do bookings only (the same rule as the Tours menu entry and app/_lib/staff.ts requireTourEditor).
    canEdit: async (user) => (await staffRoleOf(user.id)) !== "sale",
    // A tour can be submitted and published only when complete (both languages, prices, images).
    validate: tourProblems,
    // A new slug takes its departures and discount codes along; then expire at once: static pages (home) regenerate
    // from fresh tours on the next visit.
    onChange: async () => {
      try {
        await followTourSlugs?.();
      } finally {
        revalidateTag(TOURS_CACHE_TAG, { expire: 0 });
      }
    },
  },
};
