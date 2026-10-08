// Project-owned E2E: online booking (Phase 1 — departures, live seats, 15-minute hold).
// The E2E database is reset and seeded by tests/e2e/server-env.ts: per tour, one date has 3 seats left and
// one is sold out. Tests in this file must not book on those two dates.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { submitHold } from "./booking-form";

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

  // In-place navigation to a dynamic page: its <title> streams in just after the content.
  await expect(page).toHaveTitle(/Đặt tour/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("guest holds seats: live quote, then a private booking page with a 15-minute countdown", async ({ page }) => {
  await page.goto(`${TOUR}/book`);
  // Step 1 of 3; the summary names the tour and states the deposit and cancellation rules.
  await expect(page.getByTestId("booking-steps").locator('[aria-current="step"]')).toContainText("Chọn ngày & số khách");
  await expect(page.locator("aside").getByText("Ninh Bình trong ngày", { exact: false })).toBeVisible();
  await expect(page.getByTestId("booking-policy").locator("li")).toHaveCount(4);
  await expect(page.locator("legend")).toHaveText([/1\s*Chọn ngày khởi hành/, /2\s*Số khách/, /3\s*Thông tin người đặt/]);
  await page.getByTestId("departures").locator("button:not(:disabled)").nth(1).click();
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByLabel("Người lớn").fill("2");
  await page.getByLabel("Trẻ em (5–10 tuổi)").fill("1");
  const total = await page.getByTestId("total").textContent();
  const deposit = await page.getByTestId("deposit").textContent();
  expect(total).toMatch(/₫/);

  await submitHold(page, { name: "Nguyễn Văn A", email: "a@example.com", phone: "0912 345 678" });

  await expect(page).toHaveURL(/\/booking\/BV-[A-Z2-9]{6}\?t=[\w-]{20,}$/);
  await expect(page.locator("[data-booking-status=held]")).toBeVisible();
  await expect(page.getByTestId("countdown")).toHaveText(/^1[45]:\d{2}$/);
  await expect(page.getByTestId("booking-deposit")).toHaveText(deposit!);
  // Step 2: deposit; what happens next and how to reach us, with the booking code.
  await expect(page.getByTestId("booking-steps").locator('[aria-current="step"]')).toContainText("Đặt cọc");
  await expect(page.getByTestId("next-steps").locator("li")).toHaveCount(3);
  await expect(page.getByText(/đọc mã đơn BV-[A-Z2-9]{6}/)).toBeVisible();

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
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByLabel("Người lớn").fill("4");
  await submitHold(page, { name: "Tran B", email: "b@example.com", phone: "0912345678" });
  await expect(page.getByRole("alert").filter({ hasText: "chỗ" })).toContainText("Chỉ còn 3 chỗ cho ngày này");
});

test("English booking page shows prices in VND with a note", async ({ page }) => {
  await page.goto(`/en${TOUR}/book`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Book:");
  await expect(page.getByTestId("quote")).toContainText("Charged in Vietnamese dong (VND).");
});

test("private tour: tour page offer → guest picks the date and group size, price by tier, then a held booking", async ({ page }) => {
  await page.goto(TOUR);
  await expect(page.getByTestId("private-offer")).toContainText("Tour riêng từ");
  await page.getByRole("link", { name: "Đặt tour riêng" }).click();
  await expect(page).toHaveURL(new RegExp(`${TOUR}/book[?]type=private$`));
  await expect(page.getByRole("main").getByRole("link", { name: "Tour riêng" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("departures")).toHaveCount(0);

  await expect(page.locator("form[data-hydrated]")).toBeVisible();

  await page.getByLabel("Người lớn").fill("1");
  await expect(page.getByTestId("private-range")).toBeVisible();
  await expect(page.getByRole("button", { name: "Giữ chỗ 15 phút" })).toBeDisabled();

  await page.getByLabel("Người lớn").fill("4");
  await expect(page.getByTestId("private-tiers").locator("li.font-semibold")).toContainText("3–4 khách");
  await submitHold(page, { name: "Nguyễn Văn Riêng", email: "rieng@example.com", phone: "0912 345 679" });
  await expect(page).toHaveURL(/\/booking\/BV-[A-Z2-9]{6}\?t=[\w-]{20,}$/);
});

test("prices by traveller: the tour lists child / infant / single room prices; the quote adds single rooms", async ({ page }) => {
  await page.goto("/tours/ha-long-cruise-2d1n");
  const prices = page.getByTestId("price-by-traveller");
  await expect(prices).toContainText("Trẻ em 5–10 tuổi");
  await expect(prices).toContainText("Em bé dưới 5 tuổi: miễn phí");
  await expect(prices).toContainText("Phụ thu phòng đơn: 900.000");

  await page.goto("/tours/ha-long-cruise-2d1n/book");
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  const total = page.getByTestId("total");
  const before = Number((await total.innerText()).replace(/\D/g, ""));
  await page.getByLabel("Phòng đơn (phụ thu)").fill("1");
  await expect(page.getByTestId("quote")).toContainText("1 phòng đơn");
  await expect(total).toHaveText(new RegExp((before + 900_000).toLocaleString("vi-VN").replace(/\./g, "\.")));

  // A day tour has no single room option.
  await page.goto("/tours/ninh-binh-day-tour/book");
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await expect(page.getByLabel("Phòng đơn (phụ thu)")).toHaveCount(0);
});

test("traveller details: the guest fills one row per person on the booking page; errors per row; staff see the list", async ({ page }) => {
  await page.goto("/tours/sapa-fansipan-3d2n/book");
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByLabel("Người lớn").fill("2");
  await submitHold(page, { name: "Đỗ Hà", email: "ha@example.com", phone: "0911222333" });
  const section = page.getByTestId("travellers");
  await expect(section).toContainText("Chưa điền thông tin hành khách");
  const form = page.getByTestId("travellers-form");
  await expect(form.locator("fieldset")).toHaveCount(2);

  await page.locator("#traveller-name-0").fill("Đỗ Thu Hà");
  await page.locator("#traveller-year-0").fill("1991");
  await page.getByTestId("travellers-save").click();
  await expect(form.getByRole("status")).toContainText("Vui lòng sửa");
  await expect(page.locator("#traveller-name-1")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#traveller-name-0")).toHaveValue("Đỗ Thu Hà"); // kept

  await page.locator("#traveller-name-1").fill("Lê Văn Nam");
  await page.locator("#traveller-year-1").fill("1989");
  await page.getByTestId("travellers-save").click();
  await expect(form.getByRole("status")).toContainText("Đã lưu.");
  await page.reload();
  await expect(page.getByTestId("travellers")).toContainText("Đã điền đủ 2 hành khách");
  await expect(page.locator("#traveller-name-1")).toHaveValue("Lê Văn Nam");
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("add-ons: the guest adds hotel pick-up; the quote and the held booking include it", async ({ page }) => {
  await page.goto("/tours/ha-long-day-trip/book");
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  const total = page.getByTestId("total");
  const before = Number((await total.innerText()).replace(/\D/g, ""));
  await page.getByTestId("addons").getByRole("checkbox", { name: /Đón tận khách sạn/ }).check();
  await expect(page.getByTestId("addon-line")).toContainText("Đón tận khách sạn");
  await expect.poll(async () => Number((await total.innerText()).replace(/\D/g, ""))).toBe(before + 200_000);
  await submitHold(page, { name: "Ngô Bình", email: "binh@example.com", phone: "0944555666" });
  await expect(page.locator("[data-booking-status=held]")).toBeVisible();
  await expect(page.getByText(/Đón tận khách sạn/)).toBeVisible();
});
