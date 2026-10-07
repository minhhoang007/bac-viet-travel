// Project-owned E2E: staff admin for bookings and departures (Phase 3).
// Staff sign in with the real magic-link flow (token read from the E2E database), then get the admin role.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { submitHold } from "./booking-form";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ mode: "serial" });

const STAFF = "staff@bacviet.example";
const TOUR = "sapa-trekking-2d1n";

const signInAsAdmin = (page: Page, email = STAFF) => signInStaff(page, sql, email, "admin");

/** A paid booking on the first open Sapa departure (as if the VNPay IPN had arrived). */
async function paidBooking(code: string, seats: number) {
  const [d] = await sql<{ id: string; date: string }[]>`
    select id, date::text from departures where tour_slug = ${TOUR} and status = 'open' and date > current_date + 2 order by date limit 1`;
  await sql`
    insert into bookings (code, token_hash, departure_id, status, hold_expires_at, deposit_paid_at, name, email, phone, locale, adults, seats, unit_price_vnd, total_vnd, deposit_vnd)
    values (${code}, 'e2e', ${d!.id}, 'deposit_paid', now(), now(), 'Khách E2E', 'guest@example.com', '0900000001', 'vi', ${seats}, ${seats}, 1000000, ${seats * 1_000_000}, ${seats * 300_000})`;
  return d!;
}

async function seatsLeftText(page: Page, date: string) {
  await page.goto(`/tours/${TOUR}/book`);
  return page.locator(`[data-departure="${date}"]`).innerText();
}

test("staff confirm one booking and cancel another; seats return to sale; everything is audited", async ({ page }) => {
  // Several pages and an axe scan: allow for a busy machine (other files run in parallel).
  test.setTimeout(60_000);
  const departure = await paidBooking("BV-ADMN22", 2);
  await paidBooking("BV-ADMN33", 3);
  expect(await seatsLeftText(page, departure.date)).toContain("Còn 7 chỗ"); // 12 - 5

  // Guests and signed-out visitors do not see the admin area.
  expect((await page.goto("/admin/bookings"))!.status()).toBe(404);

  await signInAsAdmin(page);
  await page.goto("/admin/bookings");
  await expect(page.getByRole("link", { name: "Đơn đặt tour" })).toBeVisible(); // productAdminNav (rc.11)
  await expect(page.getByTestId("booking-stats")).toContainText("Cần xử lý");
  await expect(page.getByTestId("bookings-table")).toContainText("BV-ADMN22");

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "BV-ADMN22" }).click();
  await page.getByTestId("admin-confirm").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await expect(page.locator("[data-admin-status=confirmed]")).toBeVisible();
  await expect(page.getByTestId("admin-history")).toContainText("booking.confirm");

  // Fix the guest's contact details; seats and status stay.
  await page.getByTestId("admin-contact").getByText("Sửa thông tin liên hệ").click();
  await page.getByTestId("admin-contact").getByLabel("Số điện thoại").fill("0988777666");
  await page.getByTestId("admin-contact-save").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await expect(page.getByText("0988777666").first()).toBeVisible();
  await expect(page.locator("[data-admin-status=confirmed]")).toBeVisible();

  // The admin overview shows the booking figures, each a link to the list.
  await page.goto("/admin");
  await expect(page.getByTestId("product-stats").getByRole("link", { name: /Cần xử lý/ })).toHaveAttribute("href", "/admin/bookings?filter=attention");
  await page.goto("/admin/bookings/BV-ADMN22");

  await page.goto("/admin/bookings/BV-ADMN33");
  await page.getByLabel("Lý do huỷ (gửi cho khách)").fill("Khách đổi lịch");
  await page.getByTestId("admin-cancel").click();
  await expect(page.locator("[data-admin-status=cancelled]")).toBeVisible();
  await page.getByLabel("Ghi chú hoàn tiền (mã GD hoàn, kênh…)").fill("Hoàn qua VNPay");
  await page.getByTestId("admin-refunded").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await expect(page.getByTestId("admin-history")).toContainText("booking.refunded");

  expect(await seatsLeftText(page, departure.date)).toContain("Còn 10 chỗ");

  for (const path of ["/admin/bookings", "/admin/bookings/BV-ADMN22", "/admin/departures", "/admin/content?status=all"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path}: ${v.id}`)).toEqual([]);
  }
});

test("staff add a departure date and close another; guests see the change", async ({ page }) => {
  await signInAsAdmin(page);
  const [row0] = await sql<{ date: string }[]>`select (max(date) + 3)::text as date from departures where tour_slug = ${TOUR}`;
  const newDate = row0!.date;
  await page.goto(`/admin/departures?tour=${TOUR}`);
  await page.getByLabel("Ngày bắt đầu").fill(newDate);
  await page.getByLabel("Số chỗ", { exact: true }).fill("8");
  await page.getByTestId("add-departures").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");

  await page.goto(`/tours/${TOUR}/book`);
  await expect(page.locator(`[data-departure="${newDate}"]`)).toContainText("Còn 8 chỗ");

  await page.goto(`/admin/departures?tour=${TOUR}&month=${newDate.slice(0, 7)}`);
  const row = page.locator(`[data-departure-row="${TOUR}:${newDate}"]`);
  await row.getByLabel(`Trạng thái ${newDate}`).selectOption("closed");
  await row.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await page.goto(`/tours/${TOUR}/book`);
  await expect(page.locator(`[data-departure="${newDate}"]`)).toContainText("Đã đóng");
});

test("staff enter an OTA booking: seats shared with the website, source shown, no guest email by default", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/bookings");
  await page.getByRole("link", { name: "+ Nhập booking" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nhập booking (điện thoại, Zalo, OTA)");

  await page.getByLabel("Mã đặt chỗ bên OTA").fill("KL-E2E-1");
  await page.getByLabel("Họ tên khách").fill("John Smith");
  await page.getByLabel("Người lớn").fill("2");
  await page.getByLabel("Số tiền thực thu (VND)").fill("1500000");
  await page.getByRole("button", { name: "Tạo booking" }).click();

  await expect(page).toHaveURL(/\/admin\/bookings\/BV-[A-Z2-9]{6}\?result=done$/);
  await expect(page.getByTestId("detail-source")).toHaveText("Klook · KL-E2E-1");
  await expect(page.getByText("Không gửi email cho khách")).toBeVisible();

  await page.goto("/admin/bookings?filter=all&source=klook");
  await expect(page.getByTestId("booking-source").first()).toContainText("KL-E2E-1");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("passenger list per departure: one row per named traveller, unnamed parties flagged; print and CSV for staff only", async ({ page, request }) => {
  const d = await paidBooking("BV-PAXA22", 2);
  await sql`update bookings set adults = 2, travellers = ${sql.json([{ name: "Phạm Lan", birthYear: 1990 }, { name: "=HYPERLINK(1)", birthYear: 1985 }])} where code = 'BV-PAXA22'`;
  await sql`insert into bookings (code, token_hash, departure_id, status, hold_expires_at, deposit_paid_at, name, email, phone, locale, adults, seats, unit_price_vnd, total_vnd, deposit_vnd)
    values ('BV-PAXB33', 'e2e', ${d.id}, 'confirmed', now(), now(), 'Khách Chưa Điền', 'b@example.com', '0900000002', 'vi', 3, 3, 1000000, 3000000, 900000)`;
  expect((await request.get(`/api/admin/departures/${d.id}/passengers`)).status()).toBe(404);

  await signInAsAdmin(page, "pax-staff@bacviet.example");
  await page.goto(`/admin/departures?tour=${TOUR}&month=${d.date.slice(0, 7)}`);
  await page.locator(`[data-departure-row="${TOUR}:${d.date}"]`).getByTestId("passengers-link").click();
  const table = page.getByTestId("passengers");
  // The first test confirmed a booking on the same departure: count this test's bookings only.
  await expect(table.locator("tbody tr", { hasText: "BV-PAXA22" })).toHaveCount(2);
  await expect(table.locator("tbody tr", { hasText: "BV-PAXB33" })).toHaveCount(1);
  await expect(table).toContainText("Phạm Lan");
  await expect(table).toContainText("chưa điền tên 3 khách");
  await expect(page.getByTestId("passengers-summary")).toContainText("khách");

  const csv = await page.request.get((await page.getByTestId("passengers-csv").getAttribute("href"))!);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('"Phạm Lan","1990","NL","BV-PAXA22"');
  expect(text).toContain(`"'=HYPERLINK(1)"`); // no formula injection
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("discount codes: staff create one; the guest applies it in the booking form; the hold keeps the discounted price", async ({ page, browser }) => {
  await signInAsAdmin(page, "discount-staff@bacviet.example");
  await page.goto("/admin/discounts");
  const form = page.getByTestId("discount-form");
  await form.getByLabel("Mã (chữ, số, gạch ngang)").fill("e2e-10");
  await form.getByLabel("Giá trị (% hoặc VND)").fill("10");
  const [row] = await sql<{ to: string }[]>`select (current_date + 60)::text as to`;
  await form.getByLabel("Đến ngày").fill(row!.to);
  await page.getByTestId("discount-create").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await expect(page.locator('[data-discount="E2E-10"]')).toContainText("10%");
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/tours/ninh-binh-2d1n/book");
  await expect(guest.locator("form[data-hydrated]")).toBeVisible();
  const before = Number((await guest.getByTestId("total").innerText()).replace(/\D/g, ""));
  await guest.getByLabel("Mã giảm giá (nếu có)").fill("NOPE99");
  await guest.getByTestId("discount-apply").click();
  await expect(guest.getByTestId("discount-status")).toContainText("không hợp lệ");
  await guest.getByLabel("Mã giảm giá (nếu có)").fill("e2e-10");
  await guest.getByTestId("discount-apply").click();
  await expect(guest.getByTestId("discount-status")).toContainText("Đã áp dụng");
  await expect(guest.getByTestId("discount-line")).toBeVisible();
  const after = Number((await guest.getByTestId("total").innerText()).replace(/\D/g, ""));
  expect(after).toBeLessThan(before);

  await submitHold(guest, { name: "Vũ Mai", email: "mai@example.com", phone: "0933444555" });
  await expect(guest.locator("[data-booking-status=held]")).toBeVisible();
  await expect(guest.getByTestId("booking-discount")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-discount="E2E-10"]').getByTestId("discount-used")).toHaveText("1");

  // Edit: the form switches to this code (prefilled, code fixed); a new limit and end date are saved.
  await page.getByRole("link", { name: "Sửa E2E-10" }).click();
  await expect(form.getByText("Sửa mã E2E-10")).toBeVisible();
  await expect(form.getByLabel("Giá trị (% hoặc VND)")).toHaveValue("10");
  await form.getByLabel("Số lượt tối đa").fill("50");
  await page.getByTestId("discount-save").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await expect(page.locator('[data-discount="E2E-10"]').getByTestId("discount-used")).toHaveText("1 / 50");
  await expect(page.getByTestId("discount-create")).toBeVisible();
});

test("reports: revenue and fill rate per tour for a month range; guests get a 404", async ({ page, request }) => {
  expect((await request.get("/admin/reports")).status()).toBe(404);
  await signInAsAdmin(page, "reports-staff@bacviet.example");
  const [row] = await sql<{ from: string; to: string }[]>`select to_char(current_date, 'YYYY-MM') as from, to_char(current_date + 90, 'YYYY-MM') as to`;
  await page.goto(`/admin/reports?from=${row!.from}&to=${row!.to}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Báo cáo");
  await expect(page.getByTestId("report-tours")).toBeVisible();
  await expect(page.getByTestId("report-total")).toContainText("Tổng");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});
