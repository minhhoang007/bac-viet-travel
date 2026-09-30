import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { createJobsModule, type JobHandler } from "..";
import { jobs } from "../schema";

const handle = testDb();
const db = handle.db;
const logger = createLogger({ write: () => {} });

beforeEach(() => resetDb(db));
afterAll(() => handle.close());

const moduleWith = (handlers: Record<string, JobHandler>, leaseMs?: number) => createJobsModule({ db, logger, handlers, leaseMs });

describe("jobs module (real Postgres)", () => {
  it("parallel workers never run the same job twice", async () => {
    const runs = new Map<string, number>();
    const handler: JobHandler = async (payload) => {
      runs.set(String(payload.n), (runs.get(String(payload.n)) ?? 0) + 1);
      await new Promise((r) => setTimeout(r, 5));
    };
    const producer = moduleWith({ work: handler });
    for (let n = 0; n < 40; n++) await producer.enqueue("work", { n });

    // Four independent workers claiming concurrently over separate pool connections.
    const workers = Array.from({ length: 4 }, () => moduleWith({ work: handler }));
    const results = await Promise.all(workers.map((w) => w.runDue({ batchSize: 3 })));

    expect(results.reduce((s, r) => s + r.succeeded, 0)).toBe(40);
    expect(runs.size).toBe(40);
    expect([...runs.values()].every((count) => count === 1)).toBe(true);
  });

  it("re-claims a running job whose lease expired (worker died)", async () => {
    const seen: number[] = [];
    const m = moduleWith({ work: async (_p, job) => void seen.push(job.attempts) });
    await m.enqueue("work");
    // Simulate a crashed worker: running with an expired lease.
    await db.update(jobs).set({ status: "running", attempts: 1, lockedUntil: sql`now() - interval '1 minute'` });

    await m.runDue();
    expect(seen).toEqual([2]);
    const [row] = await db.select().from(jobs);
    expect(row).toMatchObject({ status: "succeeded", attempts: 2 });
  });

  it("does not claim a running job whose lease is still valid", async () => {
    const m = moduleWith({ work: async () => {} });
    await m.enqueue("work");
    await db.update(jobs).set({ status: "running", attempts: 1, lockedUntil: sql`now() + interval '5 minutes'` });
    expect((await m.runDue()).claimed).toBe(0);
  });

  it("retries with backoff, then marks the job dead after maxAttempts", async () => {
    const m = moduleWith({ flaky: async () => { throw new Error("boom"); } });
    await m.enqueue("flaky", {}, { maxAttempts: 2 });

    expect(await m.runDue()).toMatchObject({ claimed: 1, failed: 1 });
    let [row] = await db.select().from(jobs);
    expect(row).toMatchObject({ status: "failed", attempts: 1, lastError: "boom" });
    expect(row!.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000); // backoff ≥ 30s
    expect((await m.runDue()).claimed).toBe(0); // not due yet

    await db.update(jobs).set({ runAt: sql`now()` });
    expect(await m.runDue()).toMatchObject({ claimed: 1, dead: 1 });
    [row] = await db.select().from(jobs);
    expect(row).toMatchObject({ status: "dead", attempts: 2 });
  });

  it("dedupeKey allows one unfinished job per key, and a new one after completion", async () => {
    const m = moduleWith({ work: async () => {} });
    await m.enqueue("work", {}, { dedupeKey: "k" });
    await m.enqueue("work", {}, { dedupeKey: "k" });
    expect(await db.select().from(jobs)).toHaveLength(1);

    await m.runDue();
    await m.enqueue("work", {}, { dedupeKey: "k" });
    expect(await db.select().from(jobs).where(eq(jobs.status, "queued"))).toHaveLength(1);
  });

  it("a job without a registered handler fails instead of disappearing", async () => {
    const m = moduleWith({});
    await m.enqueue("unknown");
    expect(await m.runDue()).toMatchObject({ failed: 1 });
    const [row] = await db.select().from(jobs);
    expect(row!.lastError).toMatch(/No handler registered/);
  });

  it("purges old finished jobs (payloads may contain personal data) but keeps recent and unfinished ones", async () => {
    const m = moduleWith({ work: async () => {} });
    for (let i = 0; i < 3; i++) await m.enqueue("work", { i });
    await m.runDue();
    await m.enqueue("work", { i: "pending" });
    await db.update(jobs).set({ updatedAt: sql`now() - interval '8 days'` }).where(eq(jobs.status, "succeeded"));
    expect(await m.purgeFinished()).toBe(3);
    expect(await db.select().from(jobs)).toHaveLength(1);
  });

  it("tick runs periodic tasks and survives one that throws", async () => {
    const calls: string[] = [];
    const m = createJobsModule({
      db,
      logger,
      handlers: {},
      periodic: { bad: async () => { throw new Error("x"); }, good: async () => void calls.push("good") },
    });
    await m.tick();
    expect(calls).toEqual(["good"]);
  });
});
