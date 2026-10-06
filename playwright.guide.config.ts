import { defineConfig } from "@playwright/test";
import { e2eServerEnv } from "./tests/e2e/server-env";

// Screenshots for docs/HUONG-DAN-MARKETING.md (`pnpm guide:screens`, after `pnpm build`). Not part of CI.
export default defineConfig({
  testDir: "tests/guide",
  use: { baseURL: "http://localhost:3100", viewport: { width: 1280, height: 860 }, locale: "vi-VN" },
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: e2eServerEnv,
  },
});
