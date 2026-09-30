import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests: real Postgres (TEST_DATABASE_URL, default: docker compose db on 54329).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["**/*.int.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globalSetup: ["tests/integration/setup/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
