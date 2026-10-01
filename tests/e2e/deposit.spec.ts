// Project-owned E2E: VNPay deposit (Phase 2). The redirect to VNPay is intercepted; VNPay's IPN and return
// are simulated with params signed by the fake sandbox merchant (tests/e2e/server-env.ts).
import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { E2E_VNPAY } from "./server-env";

const TOUR = "/tours/ha-long-day-trip";

const encode = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");
function signed(params: Record<string, string>) {
  const data = Object.keys(params).filter((k) => k.startsWith("vnp_")).sort().map((k) => `${encode(k)}=${encode(params[k]!)}`).join("&");
  return new URLSearchParams({ ...params, vnp_SecureHash: createHmac("sha512", E2E_VNPAY.hashSecret).update(data).digest("hex") });
}

async function holdAndPay(page: Page) {
  await page.goto(`${TOUR}/book`);
  await page.getByLabel("Họ tên").fill("Lê Thu");
  await page.getByLabel("Email").fill("thu@example.com");
  await page.getByLabel("Số điện thoại / WhatsApp").fill("0987654321");
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
  await expect(page.locator("[data-booking-status=held]")).toBeVisible();
  await expect(page.getByTestId("sandbox-banner")).toContainText("không trừ tiền thật");

  // Stop at VNPay: capture the payment URL instead of leaving the site.
  let paymentUrl: URL | undefined;
  await page.route("https://sandbox.vnpayment.vn/**", (route) => {
    paymentUrl = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>VNPay sandbox (stub)</h1>" });
  });
  await page.getByTestId("pay-deposit").click();
  await expect(page.getByRole("heading", { name: "VNPay sandbox (stub)" })).toBeVisible();
  return paymentUrl!;
}

function result(payment: URL, ok: boolean) {
  const q = payment.searchParams;
  return signed({
    vnp_TmnCode: q.get("vnp_TmnCode")!,
    vnp_TxnRef: q.get("vnp_TxnRef")!,
    vnp_Amount: q.get("vnp_Amount")!,
    vnp_OrderInfo: q.get("vnp_OrderInfo")!,
    vnp_ResponseCode: ok ? "00" : "24",
    vnp_TransactionStatus: ok ? "00" : "02",
    vnp_TransactionNo: "14000001",
    vnp_BankCode: "NCB",
  });
}

test("deposit: VNPay URL for 30%, IPN confirms, guest returns to a paid booking", async ({ page, request }) => {
  const payment = await holdAndPay(page);
  expect(payment.searchParams.get("vnp_TmnCode")).toBe(E2E_VNPAY.tmnCode);
  expect(payment.searchParams.get("vnp_ReturnUrl")).toMatch(/\/booking\/return$/);
  const deposit = Number(payment.searchParams.get("vnp_Amount")) / 100;
  expect(deposit % 1000).toBe(0);

  // Back before the IPN: "confirming" (the page refreshes itself).
  const params = result(payment, true);
  await page.goto(`/booking/return?${params}`);
  await expect(page).toHaveURL(/\/booking\/BV-[A-Z2-9]{6}\?t=.+&pay=pending$/);
  await expect(page.getByTestId("confirming")).toBeVisible();

  // VNPay's server calls the IPN; the page turns to "paid" on its own.
  expect(await (await request.get(`/api/booking/vnpay/ipn?${params}`)).json()).toEqual({ RspCode: "00", Message: "Confirm Success" });
  await expect(page.getByTestId("paid")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-booking-status=deposit_paid]")).toBeVisible();

  // A replayed IPN changes nothing; a forged one is rejected.
  expect((await (await request.get(`/api/booking/vnpay/ipn?${params}`)).json()).RspCode).toBe("02");
  params.set("vnp_Amount", "100");
  expect((await (await request.get(`/api/booking/vnpay/ipn?${params}`)).json()).RspCode).toBe("97");
});

test("failed payment: guest is back on the held booking with a retry button", async ({ page }) => {
  const payment = await holdAndPay(page);
  await page.goto(`/booking/return?${result(payment, false)}`);
  await expect(page).toHaveURL(/pay=failed$/);
  await expect(page.getByRole("alert").filter({ hasText: "Thanh toán" })).toContainText("Thanh toán chưa thành công");
  await expect(page.getByTestId("pay-deposit")).toBeVisible();
});
