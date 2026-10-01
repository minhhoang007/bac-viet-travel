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
  now: () => Date;
}

/** Optional jobs a product registers (needs the jobs module). Names should be prefixed, e.g. "booking.". */
export interface ProductJobs {
  handlers?: Record<string, ProductJobHandler>;
  /** Run on every jobs tick (Vercel Cron → /api/jobs/run): sweeps, reminders. */
  periodic?: Record<string, () => Promise<void>>;
}
