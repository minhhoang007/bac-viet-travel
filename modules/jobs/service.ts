import { and, eq, inArray, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import type { Db } from "@/db/client";
import { jobs, type JobRow } from "./schema";

/** A transaction or the db itself: enqueue inside the caller's transaction (outbox pattern). */
export type DbExecutor = Pick<Db, "insert" | "update" | "select" | "execute">;

export type JobHandler = (payload: Record<string, unknown>, job: { id: string; attempts: number }) => Promise<void>;

export interface EnqueueOptions {
  /** At most one unfinished job per key (queued/running/failed). */
  dedupeKey?: string;
  runAt?: Date;
  maxAttempts?: number;
  tx?: DbExecutor;
}

export interface RunResult {
  claimed: number;
  succeeded: number;
  failed: number;
  dead: number;
}

export interface JobsModule {
  enqueue(name: string, payload?: Record<string, unknown>, options?: EnqueueOptions): Promise<void>;
  /** Claims and runs due jobs until the batch is empty or the time budget is used. */
  runDue(options?: { batchSize?: number; budgetMs?: number }): Promise<RunResult>;
  /** Runs periodic tasks registered by modules (sweepers, reconcile), then due jobs. */
  tick(options?: { budgetMs?: number }): Promise<RunResult>;
  /** Deletes finished jobs (payloads may hold personal data, e.g. queued emails). */
  purgeFinished(options?: { succeededDays?: number; deadDays?: number }): Promise<number>;
}

export interface JobsModuleDeps {
  db: Db;
  logger: Logger;
  handlers: Record<string, JobHandler>;
  /** Periodic tasks run on every tick (e.g. webhook sweeper). Must be cheap and idempotent. */
  periodic?: Record<string, () => Promise<void>>;
  leaseMs?: number;
  now?: () => number;
}

const MAX_BACKOFF_MS = 60 * 60_000;
export const backoffMs = (attempts: number) => Math.min(30_000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);

export function createJobsModule(deps: JobsModuleDeps): JobsModule {
  const leaseMs = deps.leaseMs ?? 5 * 60_000;
  const now = deps.now ?? Date.now;

  async function claim(batchSize: number): Promise<JobRow[]> {
    // One atomic statement: due queued/failed jobs, or running jobs whose lease expired (dead worker).
    const rows = await deps.db.execute<Record<string, unknown>>(sql`
      update jobs set status = 'running', attempts = attempts + 1,
        locked_until = now() + ${`${leaseMs} milliseconds`}::interval, updated_at = now()
      where id in (
        select id from jobs
        where (status in ('queued', 'failed') and run_at <= now())
           or (status = 'running' and locked_until < now())
        order by run_at
        limit ${batchSize}
        for update skip locked
      )
      returning id, name, payload, attempts, max_attempts`);
    return (rows as unknown as Record<string, unknown>[]).map(
      (r) =>
        ({
          id: r.id as string,
          name: r.name as string,
          payload: (r.payload ?? {}) as Record<string, unknown>,
          attempts: Number(r.attempts),
          maxAttempts: Number(r.max_attempts),
        }) as JobRow,
    );
  }

  async function finish(job: JobRow, error?: unknown): Promise<"succeeded" | "failed" | "dead"> {
    if (!error) {
      await deps.db.update(jobs).set({ status: "succeeded", lockedUntil: null, lastError: null }).where(eq(jobs.id, job.id));
      return "succeeded";
    }
    const message = error instanceof Error ? error.message : String(error);
    const dead = job.attempts >= job.maxAttempts;
    await deps.db
      .update(jobs)
      .set({
        status: dead ? "dead" : "failed",
        lockedUntil: null,
        lastError: message.slice(0, 1000),
        runAt: new Date(now() + backoffMs(job.attempts)),
      })
      .where(eq(jobs.id, job.id));
    if (dead) deps.logger.error("job.dead", { jobId: job.id, name: job.name, attempts: job.attempts });
    else deps.logger.warn("job.failed", { jobId: job.id, name: job.name, attempts: job.attempts });
    return dead ? "dead" : "failed";
  }

  async function runDue({ batchSize = 10, budgetMs = 20_000 } = {}): Promise<RunResult> {
    const deadline = now() + budgetMs;
    const result: RunResult = { claimed: 0, succeeded: 0, failed: 0, dead: 0 };
    while (now() < deadline) {
      const batch = await claim(batchSize);
      if (batch.length === 0) break;
      result.claimed += batch.length;
      for (const job of batch) {
        const handler = deps.handlers[job.name];
        let error: unknown;
        if (!handler) error = new Error(`No handler registered for job "${job.name}"`);
        else {
          try {
            await handler(job.payload, { id: job.id, attempts: job.attempts });
          } catch (e) {
            error = e;
          }
        }
        result[await finish(job, error)] += 1;
      }
    }
    return result;
  }

  async function purgeFinished({ succeededDays = 7, deadDays = 30 } = {}): Promise<number> {
    const deleted = await deps.db.execute(sql`
      delete from jobs
      where (status = 'succeeded' and updated_at < now() - make_interval(days => ${succeededDays}))
         or (status = 'dead' and updated_at < now() - make_interval(days => ${deadDays}))
      returning id`);
    return (deleted as unknown as unknown[]).length;
  }

  return {
    async enqueue(name, payload = {}, options = {}) {
      const executor = options.tx ?? deps.db;
      await executor
        .insert(jobs)
        .values({
          name,
          payload,
          dedupeKey: options.dedupeKey,
          runAt: options.runAt,
          maxAttempts: options.maxAttempts,
        })
        .onConflictDoNothing({ target: jobs.dedupeKey, where: sql`status in ('queued', 'running', 'failed')` });
    },
    runDue,
    purgeFinished,
    async tick(options = {}) {
      try {
        await purgeFinished();
      } catch (error) {
        deps.logger.error("job.purge_failed", { error });
      }
      for (const [name, task] of Object.entries(deps.periodic ?? {})) {
        try {
          await task();
        } catch (error) {
          deps.logger.error("job.periodic_failed", { task: name, error });
        }
      }
      return runDue({ budgetMs: options.budgetMs });
    },
  };
}

/** Admin/testing helper: counts by status for the given names. */
export async function jobCounts(db: Db, names: string[]) {
  const rows = await db
    .select({ status: jobs.status, n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(inArray(jobs.name, names)))
    .groupBy(jobs.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<JobRow["status"], number>>;
}
