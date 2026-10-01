import { defineConfig } from "@playwright/test";
import { E2E_BILLING } from "./tests/e2e-app/billing-secrets";

// Profile "app" browser tests. Run through `pnpm test:e2e:app` (scripts/e2e-app.sh), which prepares an
// app-profile project in a temporary clone. EMAIL_PROVIDER=console is development-only, hence `next dev`.
const PORT = 3200;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/minh_e2e";
process.env.E2E_DATABASE_URL = DATABASE_URL;
const STORAGE_ENDPOINT = process.env.E2E_STORAGE_ENDPOINT ?? "http://localhost:58333";

export default defineConfig({
  testDir: "tests/e2e-app",
  timeout: 120_000,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm dev -p ${PORT}`,
    url: `http://localhost:${PORT}/vi`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789",
      EMAIL_PROVIDER: "console",
      EMAIL_FROM: "noreply@example.com",
      CONTACT_TO_EMAIL: "owner@example.com",
      LOG_LEVEL: "warn",
      // Billing in test mode: fake-but-well-formed credentials; tests sign webhooks/IPNs with these secrets.
      CRON_SECRET: E2E_BILLING.cronSecret,
      POLAR_ACCESS_TOKEN: "polar_oat_e2e",
      POLAR_WEBHOOK_SECRET: E2E_BILLING.polarWebhookSecret,
      POLAR_SERVER: "sandbox",
      POLAR_PRODUCT_PRO_MONTHLY: E2E_BILLING.polarProductMonthly,
      POLAR_PRODUCT_PRO_YEARLY: "prod_e2e_pro_year",
      VNPAY_TMN_CODE: E2E_BILLING.vnpayTmnCode,
      VNPAY_HASH_SECRET: E2E_BILLING.vnpayHashSecret,
      // Ops modules: analytics + storage against the local S3-compatible server (bucket created by e2e-app.sh).
      ANALYTICS_SECRET: "e2e-analytics-secret-0123456789abcdef",
      STORAGE_ENDPOINT,
      STORAGE_BUCKET: "minh-e2e",
      STORAGE_ACCESS_KEY_ID: "devaccess",
      STORAGE_SECRET_ACCESS_KEY: "devsecret-local-only",
    },
  },
});
