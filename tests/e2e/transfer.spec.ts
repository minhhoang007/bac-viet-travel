// Project-owned E2E: deposit by bank transfer (VietQR). The guest chooses it on the booking page, staff record the
// money in the admin, the guest's page turns to paid. Demo bank account: offered only in payments sandbox mode.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

const TOUR = "/tours/ha-long-cruise-2d1n";
const STAFF = "transfer-staff@bacviet.example";

async function adminPage(browser: Browser) {
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.200" } })).newPage();
  await page.goto("/login");
  await page.fill("#login-email", STAFF);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  let token: string | undefined;
  for (let i = 0; i < 30 && !token; i++) {
    [{ identifier: token } = { identifier: undefined }] = await sql<{ identifier: string }[]>`
      select regexp_replace(identifier, '^magic-link:', '') as identifier from verifications where value like ${`%"${STAFF}"%`} order by created_at desc limit 1`;
    if (!token) await new Promise((r) => setTimeout(r, 300));
  }
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await sql`update users set role = 'admin' where email = ${STAFF}`;
  return page;
}

test("bank transfer: VietQR with amount and reference, seats held 2 hours, staff record it, guest sees paid", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await page.goto(`${TOUR}/book`);
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByLabel("Họ tên").fill("Phạm Hoa");
  await page.getByLabel("Email").fill("hoa@example.com");
  await page.getByLabel("Số điện thoại / WhatsApp").fill("0987000111");
  await page.getByRole("checkbox", { name: /Tôi đồng ý/ }).check();
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
  await expect(page.locator("[data-booking-status=held]")).toBeVisible();
  const code = (await page.getByTestId("booking-code").innerText()).trim();
  const deposit = (await page.getByTestId("booking-deposit").innerText()).trim();

  await page.getByTestId("choose-transfer").click();
  const panel = page.getByTestId("transfer");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("img", { name: /Mã VietQR chuyển/ }).locator("svg")).toBeVisible();
  await expect(panel).toContainText(code.replace("-", "")); // transfer note: code without the dash
  await expect(panel).toContainText(deposit);
  await expect(panel.locator('[data-demo="bank-account"]')).toContainText("KHÔNG chuyển tiền thật");
  // The hold text follows the transfer hold (not "15 phút").
  await expect(page.getByText(/Chỗ được giữ đến \d{2}:\d{2} để bạn chuyển khoản/)).toBeVisible();
  await expect(page.getByText("Chỗ được giữ trong 15 phút")).toHaveCount(0);
  // Seats held for the transfer (2 hours), not 15 minutes.
  const [row] = await sql<{ minutes: number }[]>`select extract(epoch from hold_expires_at - now()) / 60 as minutes from bookings where code = ${code}`;
  expect(Number(row!.minutes)).toBeGreaterThan(100);
  // VNPay stays available as the other way to pay.
  await expect(page.getByTestId("pay-deposit")).toBeVisible();
  await page.mouse.move(0, 0);
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Staff: the booking is in "needs attention"; less than the deposit is refused, the right amount recorded once.
  const admin = await adminPage(browser);
  await admin.goto("/admin/bookings");
  await expect(admin.getByTestId("bookings-table")).toContainText(code);
  admin.on("dialog", (dialog) => dialog.accept());
  await admin.goto(`/admin/bookings/${code}`);
  const form = admin.getByTestId("admin-transfer");
  await expect(form).toContainText("Khách đã chọn chuyển khoản");
  const depositVnd = Number(deposit.replace(/\D/g, ""));
  await form.getByLabel("Số tiền đã nhận (VND)").fill(String(depositVnd - 1000));
  await form.getByTestId("admin-transfer-save").click();
  await expect(admin.getByRole("status")).toContainText("ít hơn tiền cọc");
  await admin.getByTestId("admin-transfer").getByLabel("Mã giao dịch ngân hàng").fill("FT26100100001");
  await admin.getByTestId("admin-transfer").getByTestId("admin-transfer-save").click();
  await expect(admin.getByRole("status")).toContainText("Đã lưu.");
  await expect(admin.locator("[data-admin-status=deposit_paid]")).toBeVisible();
  await expect(admin.getByTestId("admin-transfer")).toHaveCount(0);
  await expect(admin.getByTestId("admin-history")).toContainText("booking.transfer_received");

  await page.reload();
  await expect(page.getByTestId("paid")).toBeVisible();
  await expect(page.getByTestId("transfer")).toHaveCount(0);

  // Voucher (D8): printable page with the code and a QR, and a calendar file; both need the guest's token.
  const bookingUrl = new URL(page.url());
  await page.getByTestId("open-voucher").click();
  await expect(page.getByTestId("voucher-code")).toHaveText(code);
  await expect(page.getByTestId("voucher").getByRole("img", { name: `Mã QR đơn ${code}` }).locator("svg")).toBeVisible();
  await expect(page.getByTestId("voucher")).toContainText("Chưa điền thông tin hành khách");
  const ics = await page.request.get((await page.getByTestId("voucher-ics").getAttribute("href"))!);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const cal = await ics.text();
  expect(cal).toContain(`UID:${code}@bacviet.travel`);
  expect(cal).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}/);
  expect((await page.request.get(`/api/booking/${code}/ics?t=${"x".repeat(32)}`)).status()).toBe(404);
  await page.goto(`/booking/${code}/voucher?t=${"x".repeat(32)}`);
  await expect(page.locator("[data-voucher=unavailable]")).toBeVisible();
  expect(bookingUrl.searchParams.get("t")).toBeTruthy();
});

test("tour page: when the seats cannot load, the guest is offered a retry (not \"no departures\")", async ({ page }) => {
  let fail = true;
  await page.route("**/api/tours/*/departures", (route) => (fail ? route.fulfill({ status: 503, body: "{}" }) : route.fallback()));
  await page.goto(TOUR);
  const failed = page.getByTestId("departures-failed");
  await expect(failed).toContainText("Chưa tải được lịch khởi hành");
  fail = false;
  await failed.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByTestId("tour-departures").locator("[data-loaded]")).toBeVisible();
  await expect(page.getByTestId("tour-departures").locator("[data-departure]").first()).toBeVisible();
});
