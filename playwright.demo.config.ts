import { defineConfig } from "@playwright/test";
import { demoServerEnv } from "./tests/e2e/server-env";

// The public demo site (DEMO_MODE). Run by scripts/e2e-demo.mjs after a build made with the same env, because
// DEMO_MODE is read when static pages are built.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /demo\.spec\.ts/,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "pnpm start -p 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, env: demoServerEnv },
});
