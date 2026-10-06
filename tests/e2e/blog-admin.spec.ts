// Project-owned E2E: blog posts written in the admin (S4, starter blog source "content").
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ mode: "serial" });

const sessions = new Map<string, Page>();

async function signIn(browser: Browser, email: string, role: "editor" | "admin"): Promise<Page> {
  const existing = sessions.get(email);
  if (existing) return existing;
  const page = await (await browser.newContext()).newPage();
  await signInStaff(page, sql, email, role);
  sessions.set(email, page);
  return page;
}

const status = (page: Page) => page.locator("[data-status]").first();
// Rest state: the pointer leaves the button it just clicked (hover colours are not what axe should judge).
async function seriousViolations(page: Page) {
  await page.mouse.move(0, 0);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("marketing writes a post, previews it, submits; an admin publishes; it is on the blog, its tag page and the feed", async ({ browser }) => {
  // A long scenario (two users, preview, publish, rename, feed): allow for a busy machine.
  test.setTimeout(60_000);
  const editor = await signIn(browser, "blog-writer@bacviet.example", "editor");
  await editor.goto("/admin/posts");
  // The imported MDX posts are in the CMS.
  await expect(editor.getByTestId("admin-posts").locator("tbody tr")).toHaveCount(6);
  expect(await seriousViolations(editor)).toEqual([]);

  await editor.getByRole("link", { name: "Viết bài mới" }).first().click();
  await editor.getByLabel("Tiêu đề").fill("Mùa lúa chín Mù Cang Chải");
  await editor.getByLabel("Đường dẫn (slug)").fill("mua-lua-chin-mu-cang-chai");
  await editor.getByRole("button", { name: "Tạo bản nháp" }).click();
  await expect(editor.getByText("Đã tạo bản nháp.", { exact: false })).toBeVisible();
  await expect(editor.getByTestId("post-problems")).toContainText("Mô tả ngắn");

  await editor.getByLabel("Mô tả ngắn", { exact: false }).fill("Tháng 9 đến giữa tháng 10, ruộng bậc thang vàng rực.");
  await editor.getByLabel("Thẻ").fill("mu-cang-chai, kinh-nghiem");
  await editor.getByLabel("Nội dung (Markdown)").fill('## Khi nào đi\n\nĐẹp nhất **cuối tháng 9**.\n\n<Callout tone="warning">Đường đèo nhiều sương, đi chậm.</Callout>\n\n{process.env.BETTER_AUTH_SECRET}');
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();
  await expect(editor.getByTestId("post-problems")).toHaveCount(0);
  expect(await seriousViolations(editor)).toEqual([]);
  const edit = new URL(editor.url()).pathname;
  const id = edit.split("/").pop()!;

  // Preview: the draft on the real page, Markdown rendered, no code run.
  await editor.goto(`/api/content/preview?id=${id}&locale=vi`);
  await expect(editor).toHaveURL(/\/blog\/mua-lua-chin-mu-cang-chai$/);
  await expect(editor.getByRole("status").filter({ hasText: "Đang xem trước bản nháp" })).toBeVisible();
  await expect(editor.getByRole("heading", { level: 1 })).toHaveText("Mùa lúa chín Mù Cang Chải");
  await expect(editor.locator("aside", { hasText: "Đường đèo nhiều sương" })).toBeVisible();
  await expect(editor.getByText("{process.env.BETTER_AUTH_SECRET}")).toBeVisible();
  expect(await editor.content()).not.toContain(e2eServerEnv.BETTER_AUTH_SECRET!);
  await editor.goto("/api/content/preview?exit=1&locale=vi");

  const visitor = await (await browser.newContext()).newPage();
  expect((await visitor.goto("/blog/mua-lua-chin-mu-cang-chai"))?.status()).toBe(404);

  await editor.goto(edit);
  await editor.getByRole("button", { name: "Gửi duyệt" }).click();
  await expect(status(editor)).toHaveAttribute("data-status", "pending");

  const admin = await signIn(browser, "blog-owner@bacviet.example", "admin");
  await admin.goto(edit);
  await admin.getByRole("button", { name: "Duyệt và công khai ngay" }).first().click();
  await expect(status(admin)).toHaveAttribute("data-status", "published");

  await expect(async () => {
    await visitor.goto("/blog");
    await expect(visitor.getByRole("link", { name: "Mùa lúa chín Mù Cang Chải" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // Static pages (ISR): the 404 cached before publishing is regenerated; the first visit may still get the old copy.
  await expect(async () => {
    await visitor.goto("/blog/mua-lua-chin-mu-cang-chai");
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Mùa lúa chín Mù Cang Chải", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(visitor.getByRole("status").filter({ hasText: "Đang xem trước" })).toHaveCount(0);
  await expect(async () => {
    await visitor.goto("/blog/tag/mu-cang-chai");
    await expect(visitor.getByRole("link", { name: "Mùa lúa chín Mù Cang Chải" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // Renamed after publishing: once the new version is live, the old URL redirects permanently.
  await editor.goto(edit);
  await editor.getByLabel("Đường dẫn (slug)").fill("mua-lua-chin-mu-cang-chai-2026");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();
  await admin.goto(edit);
  await admin.getByRole("button", { name: "Duyệt và công khai ngay" }).first().click();
  await expect(status(admin)).toHaveAttribute("data-status", "published");
  await expect(async () => {
    const res = await visitor.request.get("/blog/mua-lua-chin-mu-cang-chai", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toMatch(/\/blog\/mua-lua-chin-mu-cang-chai-2026$/);
  }).toPass({ timeout: 15_000 });

  // The default-locale feed path works (proxy matcher) and serves the new post once the cache refreshed.
  await expect(async () => {
    const feed = await visitor.request.get("/blog/rss.xml");
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain("<title>Mùa lúa chín Mù Cang Chải</title>");
  }).toPass({ timeout: 15_000 });

  // Covers: only a path on the site (external images are blocked by the CSP).
  await editor.goto(edit);
  await editor.getByLabel("Ảnh bìa", { exact: false }).fill("https://example.com/cover.jpg");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByTestId("post-problems")).toContainText("Ảnh bìa");
});
