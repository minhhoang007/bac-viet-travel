// Project-owned E2E: online booking (Phase 1 — departures, live seats, 15-minute hold).
// The E2E database is reset and seeded by tests/e2e/server-env.ts: per tour, one date has 3 seats left and
// one is sold out. Tests in this file must not book on those two dates.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TOUR = "/tours/ninh-binh-day-tour";

test("tour page links to online booking; departures show live seats, sold-out dates are disabled", async ({ page }) => {
  await page.goto(TOUR);
  await page.getByTestId("book-online").click();
  await expect(page).toHaveURL(new RegExp(`${TOUR}/book$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Đặt tour");

  const list = page.getByTestId("departures");
  const buttons = list.getByRole("button");
  expect(await buttons.count()).toBeGreaterThan(10);
  await expect(list.locator("button:not(:disabled)").first()).toHaveAttribute("aria-pressed", "true"); // first bookable date preselected
  await expect(buttons.filter({ hasText: "Chỉ còn 3 chỗ" })).toHaveCount(1);
  await expect(buttons.filter({ hasText: "Hết chỗ" })).toBeDisabled();

  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("guest holds seats: live quote, then a private booking page with a 15-minute countdown", async ({ page }) => {
  await page.goto(`${TOUR}/book`);
  await page.getByTestId("departures").locator("button:not(:disabled)").nth(1).click();
  await page.getByLabel("Người lớn").fill("2");
  await page.getByLabel("Trẻ em (5–10 tuổi)").fill("1");
  const total = await page.getByTestId("total").textContent();
  const deposit = await page.getByTestId("deposit").textContent();
  expect(total).toMatch(/₫/);

  await page.getByLabel("Họ tên").fill("Nguyễn Văn A");
  await page.getByLabel("Email").fill("a@example.com");
  await page.getByLabel("Số điện thoại / WhatsApp").fill("0912 345 678");
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();

  await expect(page).toHaveURL(/\/booking\/BV-[A-Z2-9]{6}\?t=[\w-]{20,}$/);
  await expect(page.locator("[data-booking-status=held]")).toBeVisible();
  await expect(page.getByTestId("countdown")).toHaveText(/^1[45]:\d{2}$/);
  await expect(page.getByTestId("booking-deposit")).toHaveText(deposit!);

  // The secret token is the key: without it the booking is not shown.
  const url = new URL(page.url());
  await page.goto(url.pathname);
  await expect(page.locator("[data-booking=not-found]")).toBeVisible();
  await page.goto(`${url.pathname}?t=wrong-token-wrong-token-wrong`);
  await expect(page.locator("[data-booking=not-found]")).toBeVisible();
});

test("server validation keeps the guest on the form; asking for more seats than left is refused", async ({ page }) => {
  await page.goto(`${TOUR}/book`);
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
  await expect(page.getByText("Vui lòng nhập thông tin này.")).toBeVisible();

  await page.getByTestId("departures").getByRole("button", { name: /Chỉ còn 3 chỗ/ }).click();
  await page.getByLabel("Người lớn").fill("4");
  await page.getByLabel("Họ tên").fill("Tran B");
  await page.getByLabel("Email").fill("b@example.com");
  await page.getByLabel("Số điện thoại / WhatsApp").fill("0912345678");
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "chỗ" })).toContainText("Chỉ còn 3 chỗ cho ngày này");
});

test("English booking page shows prices in VND with a note", async ({ page }) => {
  await page.goto(`/en${TOUR}/book`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Book:");
  await expect(page.getByTestId("quote")).toContainText("Charged in Vietnamese dong (VND).");
});
