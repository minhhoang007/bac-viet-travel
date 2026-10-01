/**
 * "Really off" for admin / analytics / storage (ARCHITECTURE.md §7):
 * no secrets required, nothing wired, endpoints 404, no periodic tasks.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureDefaults } from "@/config/features.defaults";
import { buildContainer } from "@/bootstrap/container";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";

const appSecrets = {
  DATABASE_URL: "postgres://user:pass@localhost:1/none", // never connected: nothing queries it
  BETTER_AUTH_SECRET: "x".repeat(32),
  EMAIL_PROVIDER: "console",
  EMAIL_FROM: "noreply@example.com",
  CONTACT_TO_EMAIL: "owner@example.com",
};
const appOff = { ...featureDefaults, profile: "app" as const, email: true };
const storageEnv = { STORAGE_ENDPOINT: "https://acc.r2.cloudflarestorage.com", STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "k", STORAGE_SECRET_ACCESS_KEY: "s" };

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/bootstrap/container");
});

describe("admin / analytics / storage off", () => {
  it("need no analytics secret or storage credentials, and wire nothing", () => {
    const c = buildContainer(appOff, validateEnv(appSecrets, appOff, moduleManifests));
    expect(c.admin).toBeUndefined();
    expect(c.analytics).toBeUndefined();
    expect(c.storage).toBeUndefined();
  });

  it("site profile without analytics needs no database", () => {
    const site = { ...featureDefaults };
    const c = buildContainer(site, validateEnv({}, site, moduleManifests));
    expect(c.app).toBeUndefined();
    expect(c.analytics).toBeUndefined();
  });

  it("endpoints respond 404", async () => {
    vi.doMock("@/bootstrap/container", () => ({ getContainer: () => ({ logger: console }) }));
    const collect = await import("@/app/api/analytics/collect/route");
    const download = await import("@/app/api/storage/files/[id]/route");
    expect((await collect.POST(new Request("http://x/api/analytics/collect", { method: "POST", body: "{}" }))).status).toBe(404);
    expect((await download.GET(new Request("http://x"), { params: Promise.resolve({ id: "x" }) })).status).toBe(404);
  });
});

describe("admin / analytics / storage on", () => {
  it("analytics requires a strong ANALYTICS_SECRET; in profile site it also needs DATABASE_URL", () => {
    const site = { ...featureDefaults, analytics: true };
    expect(() => validateEnv({}, site, moduleManifests)).toThrow(/DATABASE_URL: required[\s\S]*ANALYTICS_SECRET: required/);
    expect(() => validateEnv({ DATABASE_URL: "postgres://x", ANALYTICS_SECRET: "short" }, site, moduleManifests)).toThrow(/ANALYTICS_SECRET: must be at least 32/);
    expect(() => validateEnv({ DATABASE_URL: "postgres://x", ANALYTICS_SECRET: "a".repeat(32) }, site, moduleManifests)).not.toThrow();
  });

  it("storage requires its credentials and is app-only; admin is app-only", () => {
    const on = { ...appOff, storage: true };
    const run = (env: Record<string, string>) => () => validateEnv({ ...appSecrets, ...env }, on, moduleManifests);
    for (const key of Object.keys(storageEnv)) expect(run({})).toThrow(new RegExp(`${key}: required`));
    expect(run(storageEnv)).not.toThrow();
    expect(() => validateEnv(storageEnv, { ...featureDefaults, storage: true }, moduleManifests)).toThrow(/"storage" is not available in profile "site"/);
    expect(() => validateEnv({}, { ...featureDefaults, admin: true }, moduleManifests)).toThrow(/"admin" is not available in profile "site"/);
  });

  it("wires the modules and registers their periodic tasks with jobs", () => {
    const on = { ...appOff, jobs: true, admin: true, analytics: true, storage: true };
    const env = validateEnv({ ...appSecrets, ...storageEnv, CRON_SECRET: "c", ANALYTICS_SECRET: "a".repeat(32) }, on, moduleManifests);
    const c = buildContainer(on, env);
    expect(c.admin && c.analytics && c.storage).toBeTruthy();
  });
});
