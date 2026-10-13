// Project-owned E2E: admins edit the company details and bank account without a developer (owner review 2026-10-13).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("an admin replaces the demo company details and the site shows them; a bad value saves nothing", async ({ page }) => {
  await signInStaff(page, sql, "company-admin@bacviet.example", "admin");
  await page.goto("/admin/company");
  await expect(page.getByTestId("company-demo")).toBeVisible();

  const form = page.getByTestId("company-form");
  await form.getByLabel("Email nhận đặt tour").fill("not-an-email@");
  await form.getByLabel("Email nhận đặt tour").evaluate((el: HTMLInputElement) => (el.type = "text")); // past the browser check
  await form.getByTestId("company-save").click();
  await expect(page.getByRole("status")).toContainText("chưa lưu");

  await form.getByLabel("Tên pháp nhân").fill("Công ty TNHH Du lịch Bắc Việt E2E");
  await form.getByLabel("Mã số thuế").fill("0109999999");
  await form.getByLabel("Số giấy phép lữ hành").fill("01-123/2026/TCDL-GP LHQT");
  await form.getByLabel("Người đại diện theo pháp luật").fill("Trần Văn B");
  await form.getByLabel("Hotline").fill("+84 912 345 678");
  await form.getByLabel("Email nhận đặt tour").fill("booking@bacviet.travel");
  await form.getByTestId("company-save").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu");
  await expect(page.getByTestId("company-demo")).toHaveCount(0);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Cached pages are regenerated: footer, contact page and the policies use the new details.
  await page.goto("/contact");
  await expect(page.locator("footer")).toContainText("Công ty TNHH Du lịch Bắc Việt E2E");
  await expect(page.locator("footer")).toContainText("+84 912 345 678");
  await expect(page.locator('main a[href="tel:+84912345678"]').first()).toBeVisible();
  await page.goto("/cancellation");
  await expect(page.locator("main")).toContainText("+84 912 345 678");
});

test("only admins open the company page", async ({ page }) => {
  await signInStaff(page, sql, "company-editor@bacviet.example", "editor");
  expect((await page.goto("/admin/company"))!.status()).toBe(404);
});
