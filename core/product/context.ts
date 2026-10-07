import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import type { Payments } from "@/core/ports/payments";
import type { RateLimiter, RateLimitRule } from "@/core/security/rate-limit";
import type { Db } from "@/db/client";

export type ProductJobHandler = (payload: Record<string, unknown>) => Promise<void>;

/** What bootstrap gives `createProduct` (product/manifest.ts). Everything a product service usually needs. */
export interface ProductContext {
  db: Db;
  logger: Logger;
  /** Sends through the email module (retries through jobs when enabled); a no-op when email is off. */
  mail: MailPort;
  /** Shared named rate limiter (Upstash when configured). */
  rateLimiter(name: string, rule: RateLimitRule): RateLimiter;
  payments: Payments;
  /** Background jobs, when the jobs module is on. Register handlers in `ProductJobs`, enqueue here. */
  jobs?: { enqueue(name: string, payload: Record<string, unknown>, options?: { runAt?: Date; maxAttempts?: number; dedupeKey?: string }): Promise<void> };
  /** Admin audit log, when the admin module is on: records the entry only if the action succeeds and returns true. */
  audit?: {
    audited(
      actor: { id: string; email: string },
      entry: { action: string; targetType: string; targetId: string; metadata?: Record<string, unknown> },
      action: () => Promise<boolean>,
    ): Promise<boolean>;
  };
  /**
   * Published staff-edited content, when the content module is on (ADR-0009): e.g. a catalog built from published
   * items. Cache it in the page layer and revalidate in `contentTypes[type].onChange`.
   */
  content?: {
    listPublished(type: string): Promise<PublishedContent[]>;
    /** Old published slugs of live items → current slug (permanent redirects); cache it like listPublished. */
    listMoved(type: string): Promise<{ from: string; to: string }[]>;
  };
  now: () => Date;
}

export interface PublishedContent {
  id: string;
  slug: string;
  data: Record<string, unknown>;
  publishedAt: Date | null;
}

/** Context for a dynamic `sitemapPaths` function (product/manifest.ts). */
export interface SitemapContext {
  content?: ProductContext["content"];
}

/** A figure on the admin overview (manifest `adminOverview`); `href` (locale-less, e.g. "/admin/orders") makes it a link. */
export interface ProductStat {
  label: string;
  value: string | number;
  href?: string;
}

/** Optional jobs a product registers (needs the jobs module). Names should be prefixed, e.g. "booking.". */
export interface ProductJobs {
  handlers?: Record<string, ProductJobHandler>;
  /** Run on every jobs tick (Vercel Cron → /api/jobs/run): sweeps, reminders. */
  periodic?: Record<string, () => Promise<void>>;
}

/**
 * A staff-edited content type (manifest `contentTypes`, content module, ADR-0009). Keys are the type names.
 * Paths are locale-less ("/admin/tours/<id>"); the starter adds the locale.
 */
export interface ContentTypeDefinition {
  label: Record<string, string>;
  /** The project's edit page for an item. */
  adminPath(id: string): string;
  /** Public page for a slug (Draft Mode preview opens it). */
  publicPath(slug: string): string;
  /** Problems that stop submit / publish (e.g. zod issue paths); empty = complete. Drafts may be incomplete. */
  validate?(data: Record<string, unknown>): string[];
  /** After a publish, hide or unhide (also from the scheduled-publish job): e.g. revalidateTag(...). */
  onChange?(item: { id: string; type: string; slug: string; publishedSlug: string | null }): Promise<void> | void;
}
