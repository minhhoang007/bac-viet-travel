import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed", "dead"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** Idempotent enqueue: at most one unfinished job per key. */
    dedupeKey: text("dedupe_key"),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    /** Worker lease; an expired lease means the worker died and the job can be claimed again. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps(),
  },
  (t) => [
    index("jobs_claim_idx").on(t.status, t.runAt),
    uniqueIndex("jobs_dedupe_active_idx").on(t.dedupeKey).where(sql`status in ('queued', 'running', 'failed')`),
  ],
);

export type JobRow = typeof jobs.$inferSelect;
