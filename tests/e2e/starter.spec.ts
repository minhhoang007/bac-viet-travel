// Starter-owned E2E: generic guarantees of every project built from the starter.
// Content-agnostic — expected texts come from content/ and config/, so projects never need to edit this file.
// Put project-specific tests in tests/e2e/site.spec.ts.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { siteNavigation } from "@/config/navigation";
import { getAppContent, getMarketingContent } from "@/content";

const [defaultLocale, otherLocale] = [appConfig.defaultLocale, appConfig.locales.find((l) => l !== appConfig.defaultLocale)!];

test("default locale renders at / with its hero title", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", defaultLocale);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(getMarketingContent(defaultLocale).hero.title);
});

test("other locale renders with prefix, canonical and hreflang", async ({ page }) => {
  await page.goto(`/${otherLocale}`);
  await expect(page.locator("html")).toHaveAttribute("lang", otherLocale);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(getMarketingContent(otherLocale).hero.title);
  await expect(page.locator(`link[rel="alternate"][hreflang="${defaultLocale}"]`)).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${otherLocale}$`));
});

test("locale switch links to the other language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: getMarketingContent(defaultLocale).nav.switchLocale, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${otherLocale}$`));
});

test("header links come from config/navigation.ts", async ({ page }) => {
  await page.goto(`/${otherLocale}`);
  const header = page.getByRole("banner");
  for (const link of siteNavigation) {
    await expect(header.getByRole("link", { name: link.label[otherLocale], exact: true })).toHaveAttribute(
      "href",
      `/${otherLocale}${link.href}`,
    );
  }
});

test("theme colors come from config/brand.ts", async ({ page }) => {
  await page.goto("/");
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
  expect(primary).toBe(brand.colors.light.primary);
});

test("contact form follows the email module flag", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#contact")).toBeVisible();
  await expect(page.locator("#contact form")).toHaveCount(features.email ? 1 : 0);
});

test("responses carry security headers", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("robots.txt and sitemap.xml are served with legal pages", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`hreflang="${otherLocale}"`);
  expect(sitemap).toContain("/terms");
});

test("legal pages render in both locales", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(getAppContent(defaultLocale).legal.terms);
  await page.goto(`/${otherLocale}/privacy`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(getAppContent(otherLocale).legal.privacy);
});

test("profile site exposes no app routes", async ({ request }) => {
  test.skip(features.profile !== "site", "profile app has auth routes");
  expect((await request.get("/login")).status()).toBe(404);
  expect((await request.get("/api/auth/get-session")).status()).toBe(404);
  expect((await request.get("/api/account/export")).status()).toBe(404);
});

test("pricing page follows the billing module flag", async ({ request }) => {
  expect((await request.get("/pricing")).status()).toBe(features.billing ? 200 : 404);
});

test("ops modules follow their flags (admin, analytics, storage)", async ({ page, request }) => {
  if (!features.admin) expect((await request.get("/admin")).status()).toBe(404);
  if (!features.storage) expect((await request.get("/api/storage/files/00000000-0000-0000-0000-000000000000")).status()).toBe(404);
  if (!features.analytics) {
    expect((await request.post("/api/analytics/collect", { data: '{"path":"/"}' })).status()).toBe(404);
    await page.goto("/");
    await expect(page.getByRole("dialog")).toHaveCount(0); // no consent banner without analytics
  }
});

test("blog follows the module flag", async ({ request }) => {
  test.skip(features.blog, "blog on: covered by tests/e2e-app/blog.spec.ts");
  expect((await request.get("/blog")).status()).toBe(404);
  expect((await request.get("/en/blog/rss.xml")).status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/blog");
});

test("mobile: header links move into a menu sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const first = siteNavigation[0];
  test.skip(!first, "no header links configured");
  await page.getByRole("button", { name: getMarketingContent(defaultLocale).nav.menu }).click();
  const menu = page.getByTestId("mobile-menu");
  await expect(menu.getByRole("link", { name: first!.label[defaultLocale] })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("FAQ answers are in the server HTML (SEO) and open on click", async ({ page, request }) => {
  const item = getMarketingContent(defaultLocale).faq.items[0];
  test.skip(!item, "no FAQ items");
  expect(await (await request.get("/")).text()).toContain(item!.answer.replace(/&/g, "&amp;").slice(0, 20));
  await page.goto("/");
  const answer = page.locator("[data-faq-answer]").first();
  await expect(answer).toBeHidden();
  await page.getByRole("button", { name: item!.question }).click();
  await expect(answer).toBeVisible();
});

test("no serious accessibility violations on the home and legal pages (axe)", async ({ page }) => {
  for (const path of ["/", "/privacy"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});

test("share image exists for every page (og:image responds with a PNG)", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const res = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
});

test("favicon from the brand; unknown paths with a dot are 404, not 500", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="icon"]').first().getAttribute("href");
  const icon = await request.get(href!);
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toBe("image/png");
  for (const path of ["/favicon.ico", "/x.txt", "/wp-login.php"]) expect((await request.get(path)).status(), path).toBe(404);
});

test("health endpoint responds without caching", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok" });
  expect(health.headers()["cache-control"]).toBe("no-store");
});

test("profile site: /dashboard is a plain 404 (no redirect to a missing login page)", async ({ request }) => {
  test.skip(features.profile !== "site", "profile app redirects signed-out visitors to the login page");
  const res = await request.get("/dashboard", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test("unknown URLs show the site's own 404 (translated, with the header), not the framework page", async ({ page }) => {
  for (const [locale, path] of [[defaultLocale, "/no-such-page/deep"], [otherLocale, `/${otherLocale}/no-such-page`]] as const) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(getMarketingContent(locale).notFound.title);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(new RegExp(getMarketingContent(locale).notFound.title));
  }
});
