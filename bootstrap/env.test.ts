import { describe, expect, it } from "vitest";
import { defineModule } from "@/core/module";
import { featureDefaults } from "@/config/features.defaults";
import { validateEnv } from "./env";

const site = { ...featureDefaults, profile: "site" as const };
const app = { ...featureDefaults, profile: "app" as const };
const email = defineModule({ name: "email", profiles: ["site", "app"], env: ["EMAIL_API_KEY"] });

describe("validateEnv", () => {
  it("site profile needs no secrets at all", () => {
    expect(() => validateEnv({}, site, [])).not.toThrow();
  });

  it("app profile requires DB and auth secrets", () => {
    expect(() => validateEnv({}, app, [])).toThrow(/DATABASE_URL: required[\s\S]*BETTER_AUTH_SECRET: required/);
    expect(() => validateEnv({ DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "s" }, app, [])).not.toThrow();
  });

  it("requires env of enabled modules only", () => {
    expect(() => validateEnv({}, site, [email])).not.toThrow();
    expect(() => validateEnv({}, { ...site, email: true }, [email])).toThrow(/EMAIL_API_KEY: required/);
  });

  it("rejects malformed base values with a clear message", () => {
    expect(() => validateEnv({ NEXT_PUBLIC_SITE_URL: "not a url" }, site, [])).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("includes module problems in the same error", () => {
    const billing = defineModule({ name: "billing", profiles: ["app"], requires: ["jobs"] });
    expect(() => validateEnv({}, { ...site, billing: true }, [billing])).toThrow(/not available in profile "site"/);
  });
});
