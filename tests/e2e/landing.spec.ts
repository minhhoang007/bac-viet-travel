// Starter-owned E2E: optional landing blocks follow content/ (shown when their key is set, hidden otherwise),
// fit a phone screen, and pass axe. Content-agnostic, like starter.spec.ts.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { appConfig } from "@/config/app";
import { getMarketingContent } from "@/content";

const c = getMarketingContent(appConfig.defaultLocale);
const blocks = [
  { key: "logos", title: c.logos?.title },
  { key: "problemSolution", title: c.problemSolution?.title },
  { key: "steps", title: c.steps?.title },
  { key: "testimonials", title: c.testimonials?.title },
  { key: "pricing", title: c.pricing?.title },
] as const;

test("optional landing blocks appear exactly when their content is set", async ({ page }) => {
  await page.goto("/");
  for (const block of blocks) {
    if (!block.title) continue;
    await expect(page.getByRole("heading", { level: 2, name: block.title }), block.key).toBeVisible();
  }
  if (c.pricing) {
    await expect(page.locator("#pricing article")).toHaveCount(c.pricing.plans.length);
  }
  // Only one h1 on the page, whatever blocks are on.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("home page with all its blocks fits a phone screen and passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => v.id)).toEqual([]);
});
