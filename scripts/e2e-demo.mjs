// Demo-site E2E (DEMO_MODE): DEMO_MODE is read when static pages are built, so build again with it, then run
// tests/e2e/demo.spec.ts. Runs after the regular E2E (`pnpm test:e2e`), which used the build without it.
import { execSync } from "node:child_process";

const env = { ...process.env, DEMO_MODE: "true", DEMO_CONTACT_URL: "https://example.com/website-tour", E2E_UNOPTIMIZED_IMAGES: "1" };
execSync("pnpm build", { stdio: "inherit", env });
execSync("pnpm exec playwright test -c playwright.demo.config.ts", { stdio: "inherit", env });
