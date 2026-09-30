import { expect, test } from "@playwright/test";

test("default locale (vi) renders at /", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xây sản phẩm, không dựng lại hạ tầng");
});

test("English renders at /en with hreflang alternates", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build the product, not the plumbing");
  await expect(page.locator('link[rel="alternate"][hreflang="vi"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
});

test("locale switch links to the other language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("responses carry security headers", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("robots.txt and sitemap.xml are served", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("hreflang=\"en\"");
});

test("contact form is absent when the email module is off (default config)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#contact")).toBeVisible();
  await expect(page.locator("#contact form")).toHaveCount(0);
});
