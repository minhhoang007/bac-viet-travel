import { defineConfig } from "@playwright/test";

// Profile "app" browser tests. Run through `pnpm test:e2e:app` (scripts/e2e-app.sh), which prepares an
// app-profile project in a temporary clone. EMAIL_PROVIDER=console is development-only, hence `next dev`.
const PORT = 3200;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/minh_test";
process.env.E2E_DATABASE_URL = DATABASE_URL;

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
    },
  },
});
