// Browser E2E for the app shell (dashboard + admin layout): sidebar on desktop (collapse remembered in a
// cookie), menu sheet on mobile, skip link, and axe on signed-in pages.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

let ipSeq = 220;
const unique = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

async function signedIn(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${ipSeq++}` } });
  const page = await context.newPage();
  const email = unique("shell");
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const [row] = await sql<{ identifier: string }[]>`select regexp_replace(identifier, '^magic-link:', '') as identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
  await page.goto(`/api/auth/magic-link/verify?token=${row!.identifier}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
  emailOf.set(page, email);
  return page;
}

const emailOf = new WeakMap<Page, string>();

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("desktop: sidebar marks the current page and remembers being collapsed", async ({ browser }) => {
  const page = await signedIn(browser, { width: 1280, height: 800 });
  const sidebarLink = (name: string) => page.locator("[data-slot=sidebar]").getByRole("link", { name, exact: true });

  await expect(sidebarLink("Tổng quan")).toHaveAttribute("aria-current", "page");
  await sidebarLink("Tài khoản").click();
  await expect(page).toHaveURL(/\/dashboard\/account$/);
  await expect(sidebarLink("Tài khoản")).toHaveAttribute("aria-current", "page");
  await expect(sidebarLink("Tổng quan")).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  await page.getByRole("button", { name: "Ẩn/hiện menu" }).click();
  await expect(sidebarLink("Tài khoản")).not.toBeInViewport();
  await page.reload();
  await expect(sidebarLink("Tài khoản")).not.toBeInViewport();
  await page.getByRole("button", { name: "Ẩn/hiện menu" }).click();
  await expect(sidebarLink("Tài khoản")).toBeInViewport();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("mobile: menu opens in a sheet and closes after navigating", async ({ browser }) => {
  const page = await signedIn(browser, { width: 390, height: 844 });
  expect(await noHorizontalScroll(page)).toBe(true);

  // The toggle is a client component: a click before hydration is lost, so click until the sheet opens.
  const sheet = page.getByRole("dialog", { name: "Menu" });
  await expect(async () => {
    if (!(await sheet.isVisible())) await page.getByRole("button", { name: "Ẩn/hiện menu" }).click();
    await expect(sheet).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await sheet.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/account$/);
  await expect(sheet).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("skip link and no serious accessibility violations on signed-in pages (axe)", async ({ browser }) => {
  const page = await signedIn(browser, { width: 1280, height: 800 });
  const skip = page.getByRole("link", { name: "Bỏ qua, đến nội dung chính" });
  await skip.focus();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#app-content")).toBeFocused();

  const scan = async (path: string) => {
    const response = await page.goto(path);
    if (response?.status() === 404) return; // optional module off in this app
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, `${path}: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
  };
  for (const path of ["/dashboard", "/dashboard/account", "/dashboard/product/notes"]) await scan(path);

  // Admin pages (tables, notices, forms): same user promoted to admin.
  await sql`update users set role = 'admin' where email = ${emailOf.get(page)!}`;
  for (const path of ["/admin", "/admin/users", "/admin/jobs", "/admin/billing", "/admin/audit", "/admin/media", "/admin/content"]) await scan(path);
});
