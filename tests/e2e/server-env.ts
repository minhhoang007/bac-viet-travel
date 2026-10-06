// Project-owned: environment for the production server started by Playwright (`pnpm test:e2e`).
// Profile "app": the server needs a database. Loading this file resets the E2E database (its name must contain
// "e2e"), migrates it and seeds demo departures, so every run starts from the same state.
// No email is sent by these tests (successful submissions are covered by unit/integration tests).
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/bac_viet_e2e";

// Playwright also loads the config in each worker: prepare the database only once, in the main process.
if (!process.env.TEST_WORKER_INDEX) {
  // The Next.js data cache (published tours) and the pages generated at run time (ISR) belong to the previous
  // database: drop them with the reset (a tour page published in the last run would otherwise still answer 200).
  rmSync(".next/cache/fetch-cache", { recursive: true, force: true });
  rmSync(".next/server/route-cache", { recursive: true, force: true });
  for (const args of [["scripts/db-reset-test.ts"], ["scripts/db-migrate.ts"], ["scripts/seed-departures.ts", "--demo-full"],
    // Tours come from the CMS (config/tours.ts): publish the MDX tours into the empty test database.
    ["--import", "./scripts/ts-alias.mjs", "scripts/import-tours.ts", "--as", "e2e-importer@example.com", "--apply", "--create-actor"],
    // Blog posts too (config/blog.ts source "content").
    ["--import", "./scripts/ts-alias.mjs", "scripts/import-blog.ts", "--as", "e2e-importer@example.com", "--apply", "--create-actor"]]) {
    execFileSync(process.execPath, args, { env: { ...process.env, DATABASE_URL }, stdio: "pipe" });
  }
}

/** Fake VNPay sandbox merchant: tests sign IPN / return params with this secret. */
export const E2E_VNPAY = { tmnCode: "BVE2E001", hashSecret: "e2e-vnpay-hash-secret" };

export const e2eServerEnv: Record<string, string> = {
  // Auth callbacks and links must point at the Playwright server, not the dev URL in .env.local.
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  VNPAY_TMN_CODE: E2E_VNPAY.tmnCode,
  VNPAY_HASH_SECRET: E2E_VNPAY.hashSecret,
  DATABASE_URL,
  BETTER_AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789",
  // Required with the jobs module; CI has no .env.local.
  CRON_SECRET: "e2e-cron-secret-0123456789abcdef",
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "re_e2e_not_used",
  EMAIL_FROM: "booking@example.com",
  CONTACT_TO_EMAIL: "team@example.com",
};
