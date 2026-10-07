// Browser E2E for the blog module (MDX posts in content/blog; sample posts kept by --keep-example).
import { expect, test } from "@playwright/test";
import { app } from "../../content/vi/app";

// Projects rename the blog (e.g. "Cẩm nang"): read the labels from content instead of assuming "Blog".
const blog = app.blog;

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "analytics_consent", value: "denied", url: "http://localhost:3200" }]);
});

test("index → post → translation, with SEO tags and rendered MDX", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: blog.nav, exact: true }).first().click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(blog.title);

  await page.getByTestId("post-list").getByRole("link", { name: "Chào mừng đến với blog" }).click();
  await expect(page).toHaveURL(/\/blog\/chao-mung-den-voi-blog$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chào mừng đến với blog");
  await expect(page.locator("article aside")).toContainText("init:project"); // <Callout>
  await expect(page.locator("article table")).toBeVisible(); // GFM table
  await expect(page.locator('a[href="https://nextjs.org/docs"]')).toHaveAttribute("rel", "noopener noreferrer");

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "BlogPosting", headline: "Chào mừng đến với blog", inLanguage: "vi" });
  await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveAttribute("href", /\/en\/blog\/welcome-to-the-blog$/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");

  await page.getByRole("link", { name: "Đọc bằng tiếng Anh" }).click();
  await expect(page).toHaveURL(/\/en\/blog\/welcome-to-the-blog$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to the blog");
});

test("tags, RSS, sitemap and 404s", async ({ page, request }) => {
  await page.goto("/blog/tag/huong-dan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bài viết về #huong-dan");
  await expect(page.getByTestId("post-list").locator("article")).toHaveCount(1); // tag chips are list items too

  const rss = await request.get("/en/blog/rss.xml");
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(await rss.text()).toContain("<title>Welcome to the blog</title>");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/blog/chao-mung-den-voi-blog");

  for (const path of ["/blog/khong-ton-tai", "/blog/tag/khong-ton-tai", "/blog/page/2"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
