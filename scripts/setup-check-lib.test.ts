import { describe, expect, it } from "vitest";
import { diagnose, formatReport, type SetupFacts } from "./setup-check-lib";

const healthy: SetupFacts = {
  nodeVersion: "v24.3.0",
  minNodeMajor: 24,
  hasEnvFile: true,
  profile: "app",
  enabledModules: ["email", "admin"],
  envProblems: [],
  database: "ok",
};

describe("diagnose", () => {
  it("passes a healthy setup", () => {
    const report = diagnose(healthy);
    expect(report.ok).toBe(true);
    expect(formatReport(report)).toContain("All good");
    expect(formatReport(report)).toContain("modules: email, admin");
  });

  it("fails on an old Node, env problems or an unreachable database, with a hint each", () => {
    const report = diagnose({
      ...healthy,
      nodeVersion: "v22.1.0",
      envProblems: ["BETTER_AUTH_SECRET: required (profile \"app\" / enabled modules)"],
      database: "unreachable",
    });
    expect(report.ok).toBe(false);
    const failed = report.lines.filter((l) => !l.ok);
    expect(failed.map((l) => l.text)).toEqual([
      "Node v22.1.0 is too old",
      'BETTER_AUTH_SECRET: required (profile "app" / enabled modules)',
      "Database unreachable",
    ]);
    expect(failed.every((l) => l.hint)).toBe(true);
  });

  it("production: flags no Upstash, a resend.dev sender and template legal text", () => {
    const ready = { upstash: true, emailFrom: "Shop <noreply@mail.shop.vn>", legalIsTemplate: false };
    expect(diagnose({ ...healthy, production: ready }).ok).toBe(true);

    const failed = (production: SetupFacts["production"]) => diagnose({ ...healthy, production }).lines.filter((l) => !l.ok).map((l) => l.text);
    expect(failed({ ...ready, upstash: false })).toEqual(["No Upstash: rate limits count per server instance"]);
    expect(failed({ ...ready, emailFrom: "Test <onboarding@resend.dev>" })).toEqual([expect.stringContaining("resend.dev")]);
    expect(failed({ ...ready, emailFrom: undefined })).toEqual(["EMAIL_FROM not set"]);
    expect(failed({ ...ready, emailFrom: "Shop" })).toEqual(["EMAIL_FROM has no email address"]);
    expect(failed({ ...ready, legalIsTemplate: true })).toEqual(["Terms and privacy are still the template"]);
  });

  it("a missing .env.local is only a hint, not a failure", () => {
    const report = diagnose({ ...healthy, hasEnvFile: false, profile: "site", database: undefined });
    expect(report.ok).toBe(true);
    expect(formatReport(report)).toContain("cp .env.example .env.local");
  });
});
