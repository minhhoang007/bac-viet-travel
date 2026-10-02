// Browser E2E for profile "app" (vertical slice). Runs against a project initialized with
// `init:project --profile app --keep-example` (see scripts/e2e-app.sh), using EMAIL_PROVIDER=console
// and reading magic-link tokens from the database.
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });

test.afterAll(() => sql.end());

async function magicLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const [row] = await sql<{ identifier: string }[]>`
      select identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
    if (row) return `/api/auth/magic-link/verify?token=${row.identifier}&callbackURL=%2Fdashboard`;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no magic link for ${email}`);
}

async function signIn(page: Page, email: string) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto(await magicLink(email));
  await expect(page).toHaveURL(/\/dashboard$/);
}

// Each context gets its own client IP so rate-limit buckets do not leak between tests.
let ipSeq = 10;
const ctx = (browser: import("@playwright/test").Browser) =>
  browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${ipSeq++}` } });

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

test("sign in, CRUD own notes, IDOR blocked, export, delete account", async ({ browser }) => {
  const emailA = unique("a");
  const emailB = unique("b");
  const a = await (await ctx(browser)).newPage();
  const b = await (await ctx(browser)).newPage();

  // A signs in and manages a note
  await signIn(a, emailA);
  await expect(a.getByRole("heading", { level: 1 })).toContainText(emailA);
  await a.goto("/dashboard/product/notes");
  await a.getByRole("button", { name: "Thêm ghi chú" }).click();
  await expect(a.locator("#note-title-error")).toHaveText("Vui lòng nhập tiêu đề.");
  await a.fill("#note-title", "Ghi chú bí mật");
  await a.fill("#note-body", "chỉ A thấy");
  await a.getByRole("button", { name: "Thêm ghi chú" }).click();
  await a.getByText("Ghi chú bí mật").click();
  await expect(a).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  const noteUrl = a.url();
  await a.fill("#note-title", "Ghi chú đã sửa");
  await a.getByRole("button", { name: "Lưu" }).click();
  await expect(a.locator("li")).toHaveText(["Ghi chú đã sửachỉ A thấy"]);

  // B cannot see or open A's note
  await signIn(b, emailB);
  const res = await b.goto(noteUrl);
  expect(res?.status()).toBe(404);
  expect(await b.content()).not.toContain("Ghi chú đã sửa");
  await b.goto("/dashboard/product/notes");
  await expect(b.locator("li")).toHaveCount(0);

  // Export contains only B's data; anonymous export is refused
  const exported = await (await b.context().request.get("/api/account/export")).json();
  expect(exported.user.email).toBe(emailB);
  expect(exported.notes).toEqual([]);
  const anon = await ctx(browser);
  expect((await anon.request.get("/api/account/export")).status()).toBe(401);

  // A deletes the account (wrong confirmation first)
  await a.goto("/dashboard/account");
  await a.fill("#confirm-email", "wrong@example.com");
  await a.getByRole("button", { name: "Xoá tài khoản" }).click();
  await expect(a).toHaveURL(/error=confirm/);
  await a.fill("#confirm-email", emailA);
  await a.getByRole("button", { name: "Xoá tài khoản" }).click();
  await expect(a).toHaveURL(/\/$/);
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from users where email = ${emailA}`;
  expect(rows[0]?.n).toBe(0);
  await a.goto("/dashboard");
  await expect(a).toHaveURL(/\/login$/);

  // B signs out from the English dashboard
  await b.goto("/en/dashboard");
  await b.getByRole("button", { name: "Sign out" }).click();
  await expect(b).toHaveURL(/\/en$/);
  await b.goto("/en/dashboard");
  await expect(b).toHaveURL(/\/en\/login$/);
});

test("magic link requests are rate limited in the UI", async ({ browser }) => {
  const page = await (await ctx(browser)).newPage();
  const email = unique("limit");
  await page.goto("/login");
  for (let i = 0; i < 3; i++) {
    await page.fill("#login-email", email);
    await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.goto("/login");
  }
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("Bạn yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.");
});

test("an invalid magic link lands on the login page with a message", async ({ page }) => {
  await page.goto("/api/auth/magic-link/verify?token=nope&callbackURL=%2Fdashboard&errorCallbackURL=%2Flogin");
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByRole("alert").filter({ hasText: "hết hạn" })).toBeVisible();
});
