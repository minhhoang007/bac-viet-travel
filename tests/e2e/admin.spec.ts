// Project-owned E2E: staff admin for bookings and departures (Phase 3).
// Staff sign in with the real magic-link flow (token read from the E2E database), then get the admin role.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ mode: "serial" });

const STAFF = "staff@bacviet.example";
const TOUR = "sapa-trekking-2d1n";

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill("#login-email", STAFF);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  let token: string | undefined;
  for (let i = 0; i < 30 && !token; i++) {
    [{ identifier: token } = { identifier: undefined }] = await sql<{ identifier: string }[]>`
      select identifier from verifications where value like ${`%"${STAFF}"%`} order by created_at desc limit 1`;
    if (!token) await new Promise((r) => setTimeout(r, 300));
  }
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await sql`update users set role = 'admin' where email = ${STAFF}`;
}

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

  await page.goto("/admin/bookings/BV-ADMN33");
  await page.getByLabel("Lý do huỷ (gửi cho khách)").fill("Khách đổi lịch");
  await page.getByTestId("admin-cancel").click();
  await expect(page.locator("[data-admin-status=cancelled]")).toBeVisible();
  await page.getByLabel("Ghi chú hoàn tiền (mã GD hoàn, kênh…)").fill("Hoàn qua VNPay");
  await page.getByTestId("admin-refunded").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await expect(page.getByTestId("admin-history")).toContainText("booking.refunded");

  expect(await seatsLeftText(page, departure.date)).toContain("Còn 10 chỗ");

  for (const path of ["/admin/bookings", "/admin/bookings/BV-ADMN22", "/admin/departures"]) {
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
