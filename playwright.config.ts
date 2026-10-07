import { defineConfig } from "@playwright/test";
import { e2eServerEnv } from "./tests/e2e/server-env";

export default defineConfig({
  testDir: "tests/e2e",
  // Traces of failed tests land in test-results/ (CI uploads them): open with `pnpm exec playwright show-trace`.
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    // Project-owned (tests/e2e/server-env.ts): env the production server needs for enabled modules.
    env: e2eServerEnv,
  },
});
