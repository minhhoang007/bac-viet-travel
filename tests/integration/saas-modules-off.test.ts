/**
 * "Really off" for jobs / entitlements / billing (ARCHITECTURE.md §7):
 * no secrets required, nothing wired, endpoints 404, no job handlers.
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
const saasOn = { ...appOff, jobs: true, entitlements: true, billing: true };

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/bootstrap/container");
});

describe("SaaS modules off", () => {
  it("need no CRON_SECRET or payment credentials", () => {
    expect(() => validateEnv(appSecrets, appOff, moduleManifests, { billingProviders: ["polar", "vnpay"] })).not.toThrow();
  });

  it("wire no jobs, entitlements or billing", () => {
    const c = buildContainer(appOff, validateEnv(appSecrets, appOff, moduleManifests));
    expect(c.jobs).toBeUndefined();
    expect(c.entitlements).toBeUndefined();
    expect(c.billing).toBeUndefined();
  });

  it("endpoints respond 404", async () => {
    vi.doMock("@/bootstrap/container", () => ({ getContainer: () => ({ logger: console }) }));
    const jobsRoute = await import("@/app/api/jobs/run/route");
    const polarRoute = await import("@/app/api/billing/webhooks/polar/route");
    const ipnRoute = await import("@/app/api/billing/vnpay/ipn/route");
    expect((await jobsRoute.GET(new Request("http://x/api/jobs/run"))).status).toBe(404);
    expect((await polarRoute.POST(new Request("http://x/api/billing/webhooks/polar", { method: "POST", body: "{}" }))).status).toBe(404);
    expect((await ipnRoute.GET(new Request("http://x/api/billing/vnpay/ipn?vnp_TxnRef=1"))).status).toBe(404);
  });
});

describe("SaaS modules on", () => {
  it("require CRON_SECRET and the credentials of each enabled provider", () => {
    const run = () => validateEnv(appSecrets, saasOn, moduleManifests, { billingProviders: ["polar", "vnpay"] });
    for (const key of ["CRON_SECRET", "POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET", "POLAR_PRODUCT_PRO_MONTHLY", "VNPAY_TMN_CODE", "VNPAY_HASH_SECRET"]) {
      expect(run).toThrow(new RegExp(`${key}: required`));
    }
  });

  it("only VNPay enabled → no Polar credentials needed", () => {
    const env = { ...appSecrets, CRON_SECRET: "c", VNPAY_TMN_CODE: "T", VNPAY_HASH_SECRET: "S" };
    expect(() => validateEnv(env, saasOn, moduleManifests, { billingProviders: ["vnpay"] })).not.toThrow();
  });

  it("billing requires jobs and entitlements to be enabled (fail fast)", () => {
    const env = { ...appSecrets, CRON_SECRET: "c" };
    expect(() => validateEnv(env, { ...appOff, billing: true }, moduleManifests, { billingProviders: [] })).toThrow(
      /"billing" requires "entitlements"[\s\S]*"billing" requires "jobs"/,
    );
  });

  it("refuses the Polar sandbox in production", () => {
    const env = {
      ...appSecrets,
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
      EMAIL_PROVIDER: "resend",
      EMAIL_API_KEY: "k",
      CRON_SECRET: "c",
      POLAR_ACCESS_TOKEN: "t",
      POLAR_WEBHOOK_SECRET: "w",
      POLAR_PRODUCT_PRO_MONTHLY: "m",
      POLAR_PRODUCT_PRO_YEARLY: "y",
    };
    expect(() => validateEnv(env, saasOn, moduleManifests, { billingProviders: ["polar"] })).toThrow(/POLAR_SERVER/);
  });
});

describe("jobs endpoint auth", () => {
  it("rejects a missing or wrong cron secret", async () => {
    vi.doMock("@/bootstrap/container", () => ({ getContainer: () => ({ jobs: { tick: vi.fn(async () => ({ claimed: 0, succeeded: 0, failed: 0, dead: 0 })) }, logger: console }) }));
    vi.doMock("@/bootstrap/env", () => ({ getEnv: () => ({ extra: { CRON_SECRET: "right-secret" } }) }));
    const { GET } = await import("@/app/api/jobs/run/route");
    expect((await GET(new Request("http://x"))).status).toBe(401);
    expect((await GET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await GET(new Request("http://x", { headers: { authorization: "Bearer right-secret" } }))).status).toBe(200);
    vi.doUnmock("@/bootstrap/env");
  });
});
