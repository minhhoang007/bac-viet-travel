import { afterAll, describe, expect, it, vi } from "vitest";
import { testDb } from "./setup/db";
import { testApp } from "./setup/app";

const handle = testDb();
afterAll(() => handle.close());

describe("health and shared limiters", () => {
  it("container.health() reports the database and where rate limits are counted", async () => {
    const t = testApp(handle.db);
    expect(await t.container.health()).toEqual({ db: "ok", rateLimit: "local" });
    // Upstash set but not answering (a wrong URL or token): reported, not hidden behind the in-memory fallback.
    const wrong = testApp(handle.db, { env: { UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9", UPSTASH_REDIS_REST_TOKEN: "wrong" } });
    expect(await wrong.container.health()).toEqual({ db: "ok", rateLimit: "error" });
  });

  it("/api/health: 200 when healthy, 503 when the database is down, never cached", async () => {
    vi.resetModules();
    vi.doMock("@/bootstrap/container", () => ({ getContainer: () => ({ health: async () => ({ db: "error" }) }) }));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: "degraded", commit: "dev", checks: { db: "error" } });
    vi.doUnmock("@/bootstrap/container");
  });

  it("rateLimiter(name) is memoized per name and enforces its rule", async () => {
    const t = testApp(handle.db);
    const a = t.container.rateLimiter("booking", { max: 1, windowMs: 60_000 });
    expect(t.container.rateLimiter("booking", { max: 1, windowMs: 60_000 })).toBe(a);
    expect((await a.limit("ip")).success).toBe(true);
    expect((await a.limit("ip")).success).toBe(false);
  });
});
