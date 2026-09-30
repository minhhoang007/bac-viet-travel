// Project-owned E2E: tests for your product pages and content.
// Generic starter guarantees live in tests/e2e/starter.spec.ts (starter-owned, do not edit).
import { expect, test } from "@playwright/test";

test("home page responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
});
