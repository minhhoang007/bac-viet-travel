// Public demo site (DEMO_MODE, server on :3101 sharing the E2E database). The daily reset is not run here (it would
// wipe the other specs' data): the demo staff are created directly, as product/demo/reset.ts does.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { DEMO_STAFF } from "@/product/demo/staff";
import { e2eServerEnv } from "./server-env";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeAll(async () => {
  for (const s of DEMO_STAFF) {
    const [u] = await sql<{ id: string }[]>`
      insert into users (email, name, email_verified, role) values (${s.email}, ${s.name}, true, 'editor')
      on conflict (email) do update set role = 'editor', status = 'active' returning id`;
    await sql`insert into staff_roles (user_id, role) values (${u!.id}, ${s.role}) on conflict (user_id) do update set role = ${s.role}`;
  }
});

test("every page says it is a demo and is kept out of search engines", async ({ page, request }) => {
  await page.goto("/");
  const notice = page.getByTestId("demo-notice");
  await expect(notice).toContainText("Website mẫu cho công ty lữ hành");
  await expect(notice.getByRole("link", { name: "Vào thử trang quản trị" })).toHaveAttribute("href", "/demo");
  await expect(notice.getByRole("link", { name: "Nhận báo giá" })).toHaveAttribute("href", "https://example.com/website-tour");
  // The notice already says it is a sample: the footer drops the "(demo)" placeholder markers.
  await expect(page.getByTestId("company-info")).not.toContainText("(demo)");
  await expect(page.locator('meta[name="robots"][content="noindex, nofollow"]')).toHaveCount(1);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /");
  expect(robots).not.toContain("Sitemap:");
});

test("a visitor tries the admin as the manager in one click, no second factor; the sign-in email is in the demo mailbox", async ({ page }) => {
  await page.goto("/demo");
  const accounts = page.getByTestId("demo-accounts");
  await expect(accounts.getByRole("heading", { name: "Quản lý" })).toBeVisible();
  await expect(accounts.getByRole("heading", { name: "Sale" })).toBeVisible();
  await expect(page.getByTestId("demo-steps").locator("li")).toHaveCount(3);
  await expect(page.locator("main").getByRole("link", { name: "Nhận báo giá" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await accounts.getByRole("listitem").filter({ hasText: "Quản lý" }).getByRole("button", { name: "Vào với vai trò này" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings/);
  await expect(page.getByRole("heading", { level: 1, name: "Đơn đặt tour" })).toBeVisible();
  await expect(page.getByTestId("demo-notice")).toBeVisible();

  await page.getByRole("link", { name: "Hộp thư demo" }).click();
  await expect(page.getByTestId("demo-mailbox")).toContainText(DEMO_STAFF[0]!.email);
});

test("the sale account opens bookings but not the manager's pages", async ({ page }) => {
  await page.goto("/demo");
  await page.getByTestId("demo-accounts").getByRole("listitem").filter({ hasText: "Sale" }).getByRole("button", { name: "Vào với vai trò này" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings/);
  expect((await page.goto("/admin/reports"))?.status()).toBe(404);
});
