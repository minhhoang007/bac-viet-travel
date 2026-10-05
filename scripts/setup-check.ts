// Checks that this machine and config can run the project: Node version, env for the profile and enabled modules,
// database connection. Prints variable names only, never values.
// Usage: pnpm setup:check
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { envProblems } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { authConfig } from "@/config/auth";
import { billingConfig } from "@/config/billing";
import { features } from "@/config/features";
import { isModuleEnabled } from "@/core/module";
import { diagnose, formatReport } from "./setup-check-lib";

async function databaseStatus(url: string | undefined): Promise<"ok" | "unreachable" | undefined> {
  if (features.profile !== "app" || !url) return undefined;
  const client = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await client`select 1`;
    return "ok";
  } catch {
    return "unreachable";
  } finally {
    await client.end({ timeout: 1 });
  }
}

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { engines?: { node?: string } };
const report = diagnose({
  nodeVersion: process.version,
  minNodeMajor: Number.parseInt(pkg.engines?.node?.replace(/[^\d.]/g, "") ?? "0", 10),
  hasEnvFile: existsSync(".env.local"),
  profile: features.profile,
  enabledModules: moduleManifests.filter((m) => isModuleEnabled(features, m.name)).map((m) => m.name),
  envProblems: envProblems(process.env, features, moduleManifests, { auth: authConfig, billingProviders: billingConfig.providers }),
  database: await databaseStatus(process.env.DATABASE_URL),
});
console.log(formatReport(report));
process.exitCode = report.ok ? 0 : 1;
