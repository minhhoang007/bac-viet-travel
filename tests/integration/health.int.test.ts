import { afterAll, describe, expect, it, vi } from "vitest";
import { testDb } from "./setup/db";
import { testApp } from "./setup/app";

const handle = testDb();
afterAll(() => handle.close());

describe("health and shared limiters", () => {
  it("container.health() reports the database", async () => {
    const t = testApp(handle.db);
    expect(await t.container.health()).toEqual({ db: "ok" });
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
