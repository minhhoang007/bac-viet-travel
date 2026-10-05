// Browser E2E for billing (profile app + jobs/entitlements/billing), with provider traffic simulated:
// Polar webhooks signed with the test webhook secret, VNPay IPNs signed with the test hash secret.
import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_BILLING } from "./billing-secrets";

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

let ipSeq = 100;
const newPage = async (browser: import("@playwright/test").Browser) =>
  (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${ipSeq++}` } })).newPage();

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const [row] = await sql<{ identifier: string }[]>`select regexp_replace(identifier, '^magic-link:', '') as identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
  await page.goto(`/api/auth/magic-link/verify?token=${row!.identifier}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

const userId = async (email: string) => (await sql<{ id: string }[]>`select id from users where email = ${email}`)[0]!.id;
const unique = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

// Standard Webhooks signature (what Polar sends).
function polarHeaders(id: string, body: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(E2E_BILLING.polarWebhookSecret.slice("whsec_".length), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}`, "content-type": "application/json" };
}

// VNPay signature: sorted, encoded params, HMAC-SHA512.
function vnpaySigned(params: Record<string, string>) {
  const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");
  const data = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k]!)}`).join("&");
  return { ...params, vnp_SecureHash: createHmac("sha512", E2E_BILLING.vnpayHashSecret).update(data).digest("hex") };
}

// Runs first: once a subscription exists, the tick would reconcile against the real Polar API.
test("cron endpoint requires the secret and runs the tick", async ({ request }) => {
  expect((await request.get("/api/jobs/run")).status()).toBe(401);
  const ok = await request.get("/api/jobs/run", { headers: { authorization: `Bearer ${E2E_BILLING.cronSecret}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toHaveProperty("claimed");
});

test("pricing page lists plans from config", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bảng giá");
  await expect(page.getByText("199.000")).toBeVisible();
});

test("billing page shows Free, menu entry is localized", async ({ browser }) => {
  const page = await newPage(browser);
  await signIn(page, unique("free"));
  await page.getByRole("link", { name: "Thanh toán" }).click();
  await expect(page.getByTestId("current-plan")).toHaveText("Miễn phí");
});

test("VNPay: payment URL → signed IPN → Pro for 30 days; return page shows success; replay answers 02", async ({ browser }) => {
  const page = await newPage(browser);
  const email = unique("vnpay");
  await signIn(page, email);
  await page.goto("/dashboard/billing");

  // Capture the redirect to VNPay instead of leaving the app.
  let paymentUrl = "";
  await page.route("https://sandbox.vnpayment.vn/**", (route) => {
    paymentUrl = route.request().url();
    return route.fulfill({ status: 200, body: "vnpay sandbox (stubbed)" });
  });
  await page.getByRole("button", { name: /^1 tháng · 199\.000/ }).click();
  await expect.poll(() => paymentUrl).toContain("vnp_Amount=19900000");
  const pay = Object.fromEntries(new URL(paymentUrl).searchParams);

  const ipn = vnpaySigned({
    vnp_TmnCode: E2E_BILLING.vnpayTmnCode,
    vnp_Amount: pay.vnp_Amount!,
    vnp_TxnRef: pay.vnp_TxnRef!,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14111111",
    vnp_OrderInfo: pay.vnp_OrderInfo!,
    vnp_PayDate: "20261001120000",
  });
  const qs = new URLSearchParams(ipn).toString();
  expect(await (await page.request.get(`/api/billing/vnpay/ipn?${qs}`)).json()).toEqual({ RspCode: "00", Message: "Confirm Success" });
  expect(await (await page.request.get(`/api/billing/vnpay/ipn?${qs}`)).json()).toMatchObject({ RspCode: "02" });

  await page.goto(`/billing/vnpay-return?${qs}`);
  await expect(page.locator("p[role=status][data-status]")).toHaveAttribute("data-status", "paid");

  await page.goto("/dashboard/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro");
  await expect(page.getByText(/Hiệu lực đến/)).toBeVisible();
});

test("VNPay: forged IPN is rejected (97) and grants nothing", async ({ request }) => {
  const qs = new URLSearchParams({ vnp_TmnCode: E2E_BILLING.vnpayTmnCode, vnp_TxnRef: "x", vnp_Amount: "100", vnp_SecureHash: "0".repeat(128) });
  expect(await (await request.get(`/api/billing/vnpay/ipn?${qs}`)).json()).toMatchObject({ RspCode: "97" });
});

test("Polar: signed subscription webhook → processed right after the response → Pro with auto-renew", async ({ browser }) => {
  const page = await newPage(browser);
  const email = unique("polar");
  await signIn(page, email);
  const id = await userId(email);

  const body = JSON.stringify({
    type: "subscription.active",
    timestamp: new Date().toISOString(),
    data: {
      id: `sub_${Date.now()}`,
      status: "active",
      product_id: E2E_BILLING.polarProductMonthly,
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      cancel_at_period_end: false,
      ended_at: null,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      customer: { external_id: id },
    },
  });
  const res = await page.request.post("/api/billing/webhooks/polar", { data: body, headers: polarHeaders(`msg_${Date.now()}`, body) });
  expect(res.status()).toBe(202);

  await expect
    .poll(async () => (await sql<{ status: string }[]>`select status from webhook_events order by received_at desc limit 1`)[0]?.status)
    .toBe("processed");
  await page.goto("/dashboard/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro");
  await expect(page.getByText(/Tự động gia hạn qua Polar/)).toBeVisible();
});

test("Polar: forged webhook → 403 and nothing stored", async ({ request }) => {
  const before = (await sql<{ n: number }[]>`select count(*)::int as n from webhook_events`)[0]!.n;
  const body = JSON.stringify({ type: "subscription.active", data: {} });
  const res = await request.post("/api/billing/webhooks/polar", {
    data: body,
    headers: { "webhook-id": "msg_forged", "webhook-timestamp": String(Math.floor(Date.now() / 1000)), "webhook-signature": "v1,AAAA", "content-type": "application/json" },
  });
  expect(res.status()).toBe(403);
  expect((await sql<{ n: number }[]>`select count(*)::int as n from webhook_events`)[0]!.n).toBe(before);
});
