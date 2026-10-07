// Browser E2E for the sign-in email paths people actually take: the confirmation page's button and the 6-digit code.
// Both must end with the session cookie in the browser (a server-side redirect would use the link up on the server).
import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

// Same values as playwright.app.config.ts.
const SITE = "http://localhost:3200";
const SECRET = "e2e-secret-0123456789abcdef0123456789";
const unique = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

let ip = 20;
/** Asks for a sign-in email and returns the one-time link it carries (token read from the E2E database). */
async function requestLink(page: Page, email: string): Promise<string> {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${ip++}` });
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const [row] = await sql<{ token: string }[]>`select regexp_replace(identifier, '^magic-link:', '') as token from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
  return `${SITE}/api/auth/magic-link/verify?token=${row!.token}&callbackURL=%2Fdashboard&errorCallbackURL=%2Flogin`;
}

test("the emailed link: the confirmation page's button signs this browser in", async ({ page }) => {
  const email = unique("confirm");
  const link = await requestLink(page, email);
  // A mail scanner only loads the page: the link stays unused.
  const fresh = await page.context().browser()!.newPage();
  await fresh.goto(`/login/confirm?link=${encodeURIComponent(link)}`);
  await fresh.close();

  await page.goto(`/login/confirm?link=${encodeURIComponent(link)}`);
  await page.getByTestId("confirm-sign-in-button").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/); // still signed in: the cookie is in this browser
});

test("a link to anywhere else is refused on the confirmation page", async ({ page }) => {
  await page.goto(`/login/confirm?link=${encodeURIComponent("https://evil.example/api/auth/magic-link/verify?token=x")}`);
  await expect(page.getByTestId("confirm-sign-in-button")).toHaveCount(0);
  await expect(page.getByText("Liên kết không hợp lệ")).toBeVisible();
});

test("the 6-digit code signs in on this device; a wrong code says so", async ({ page }) => {
  const email = unique("code");
  const link = await requestLink(page, email);
  // The real code is only in the email (stored hashed): put a known one in its place, hashed the same way.
  const code = "246810";
  const hash = createHmac("sha256", SECRET).update(`login-code:${email}:${code}`).digest("base64url");
  await sql`delete from verifications where identifier = ${`login-code:${email}`}`;
  await sql`insert into verifications (identifier, value, expires_at) values (${`login-code:${email}`}, ${JSON.stringify({ hash, link, attempts: 0 })}, now() + interval '10 minutes')`;

  const form = page.getByTestId("login-code");
  await form.getByLabel("Mã đăng nhập").fill("135790");
  await form.getByRole("button", { name: "Đăng nhập bằng mã" }).click();
  await expect(form.getByText("Mã không đúng hoặc đã hết hạn.")).toBeVisible();

  await form.getByLabel("Mã đăng nhập").fill(code);
  await form.getByRole("button", { name: "Đăng nhập bằng mã" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
});
