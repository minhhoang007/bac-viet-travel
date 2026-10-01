// Project-owned: environment for the production server started by Playwright (`pnpm test:e2e`).
// Profile "app": the server needs a database. Loading this file resets the E2E database (its name must contain
// "e2e"), migrates it and seeds demo departures, so every run starts from the same state.
// No email is sent by these tests (successful submissions are covered by unit/integration tests).
import { execFileSync } from "node:child_process";

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/bac_viet_e2e";

// Playwright also loads the config in each worker: prepare the database only once, in the main process.
if (!process.env.TEST_WORKER_INDEX) {
  for (const args of [["scripts/db-reset-test.ts"], ["scripts/db-migrate.ts"], ["scripts/seed-departures.ts", "--demo-full"]]) {
    execFileSync(process.execPath, args, { env: { ...process.env, DATABASE_URL }, stdio: "pipe" });
  }
}

/** Fake VNPay sandbox merchant: tests sign IPN / return params with this secret. */
export const E2E_VNPAY = { tmnCode: "BVE2E001", hashSecret: "e2e-vnpay-hash-secret" };

export const e2eServerEnv: Record<string, string> = {
  VNPAY_TMN_CODE: E2E_VNPAY.tmnCode,
  VNPAY_HASH_SECRET: E2E_VNPAY.hashSecret,
  DATABASE_URL,
  BETTER_AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789",
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "re_e2e_not_used",
  EMAIL_FROM: "booking@example.com",
  CONTACT_TO_EMAIL: "team@example.com",
};
