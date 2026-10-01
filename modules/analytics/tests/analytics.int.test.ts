import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { createAnalyticsModule } from "..";
import { analyticsEvents } from "../schema";

const handle = testDb();
const db = handle.db;
let clock = new Date("2026-10-01T10:00:00Z");
const analytics = createAnalyticsModule({ db, secret: "s".repeat(32), now: () => clock });
const visit = { ip: "203.0.113.7", userAgent: "Mozilla/5.0 Firefox/140", siteHost: "example.com" };

beforeEach(async () => {
  await resetDb(db);
  clock = new Date("2026-10-01T10:00:00Z");
});
afterAll(() => handle.close());

const rows = () => db.select().from(analyticsEvents);

describe("analytics: collection and privacy", () => {
  it("without consent: an anonymous count, no visitor hash, no user", async () => {
    const [u] = await db.insert(users).values({ email: "a@example.com" }).returning();
    await analytics.collect({ ...visit, path: "/pricing", consent: false, userId: u!.id });
    expect(await rows()).toEqual([expect.objectContaining({ name: "page_view", path: "/pricing", visitorHash: null, userId: null })]);
  });

  it("with consent: a daily visitor hash that changes the next day; IP and user agent are never stored", async () => {
    await analytics.collect({ ...visit, path: "/", consent: true });
    await analytics.collect({ ...visit, path: "/en", consent: true });
    clock = new Date("2026-10-02T10:00:00Z");
    await analytics.collect({ ...visit, path: "/", consent: true });
    const hashes = (await rows()).map((r) => r.visitorHash);
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[2]).not.toBe(hashes[0]);
    const dump = JSON.stringify(await db.execute(sql`select * from analytics_events`));
    expect(dump).not.toContain(visit.ip);
    expect(dump).not.toContain("Firefox");
  });

  it("drops query strings (tokens, emails), ignores bots and invalid paths, keeps only external referrer hosts", async () => {
    await analytics.collect({ ...visit, path: "/login?token=secret#x", referrer: "https://www.google.com/search?q=me", consent: false });
    await analytics.collect({ ...visit, path: "/a", referrer: "https://example.com/b", consent: false });
    expect(await analytics.collect({ ...visit, userAgent: "Googlebot/2.1", path: "/", consent: false })).toBe(false);
    expect(await analytics.collect({ ...visit, path: "https://evil.test/", consent: false })).toBe(false);
    expect(await analytics.collect({ ...visit, path: "//evil.test", consent: false })).toBe(false);
    const stored = await rows();
    expect(stored.map((r) => [r.path, r.referrerHost])).toEqual([["/login", "www.google.com"], ["/a", null]]);
  });

  it("custom events need a safe name", async () => {
    await analytics.track("project_created", { props: { template: "blank" } });
    await expect(analytics.track("Bad Name")).rejects.toThrow(/invalid/);
  });
});

describe("analytics: stats, retention, export", () => {
  it("aggregates views, unique visitors, top pages and events per day", async () => {
    clock = new Date("2026-09-30T10:00:00Z");
    await analytics.collect({ ...visit, path: "/", consent: true });
    clock = new Date("2026-10-01T10:00:00Z");
    await analytics.collect({ ...visit, path: "/", consent: true });
    await analytics.collect({ ...visit, path: "/", consent: true });
    await analytics.collect({ ...visit, ip: "198.51.100.1", path: "/pricing", consent: true });
    await analytics.collect({ ...visit, path: "/pricing", consent: false });
    await analytics.track("signup_completed");

    const s = await analytics.stats(3);
    expect(s.daily).toEqual([
      { day: "2026-09-29", views: 0, visitors: 0 },
      { day: "2026-09-30", views: 1, visitors: 1 },
      { day: "2026-10-01", views: 4, visitors: 2 },
    ]);
    expect(s.topPages).toEqual([{ path: "/", views: 3 }, { path: "/pricing", views: 2 }]);
    expect(s.events).toEqual([{ name: "signup_completed", count: 1 }]);
  });

  it("purges events past the retention window", async () => {
    clock = new Date("2025-08-01T00:00:00Z");
    await analytics.collect({ ...visit, path: "/old", consent: false });
    clock = new Date("2026-10-01T00:00:00Z");
    await analytics.collect({ ...visit, path: "/new", consent: false });
    expect(await analytics.purge()).toBe(1);
    expect((await rows()).map((r) => r.path)).toEqual(["/new"]);
  });

  it("export contains only the user's consented events; account deletion unlinks them", async () => {
    const [u] = await db.insert(users).values({ email: "a@example.com" }).returning();
    await analytics.collect({ ...visit, path: "/x", consent: true, userId: u!.id });
    await analytics.collect({ ...visit, path: "/y", consent: false, userId: u!.id });
    expect((await analytics.exportForUser(u!.id)).map((e) => (e as { path: string }).path)).toEqual(["/x"]);
    await db.delete(users).where(sql`id = ${u!.id}`);
    expect((await rows()).every((r) => r.userId === null)).toBe(true);
  });
});
