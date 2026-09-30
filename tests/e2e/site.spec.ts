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

test("theme colors come from config/brand.ts", async ({ page }) => {
  await page.goto("/");
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
  expect(primary).toBe("#2563eb"); // brandDefaults.colors.light.primary
});

test("profile site exposes no app routes", async ({ request }) => {
  expect((await request.get("/login")).status()).toBe(404);
  expect((await request.get("/api/auth/get-session")).status()).toBe(404);
  expect((await request.get("/api/account/export")).status()).toBe(404);
});

test("legal pages render in both locales", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Điều khoản sử dụng");
  await page.goto("/en/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
});

test("header links come from config/navigation.ts and sitemap includes legal pages", async ({ page, request }) => {
  await page.goto("/en");
  await expect(page.getByRole("banner").getByRole("link", { name: "FAQ", exact: true })).toHaveAttribute("href", "/en/#faq");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/terms");
});
