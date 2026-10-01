// Browser E2E for V1.2 ops modules: admin (+ audit log), analytics (consent), storage (direct upload to an
// S3-compatible server: the docker compose `storage` service locally, standing in for Cloudflare R2).
import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

let ipSeq = 150;
const newPage = async (browser: Browser, consent?: "granted" | "denied") => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${ipSeq++}` } });
  if (consent) await context.addCookies([{ name: "analytics_consent", value: consent, url: "http://localhost:3200" }]);
  return context.newPage();
};
const unique = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const [row] = await sql<{ identifier: string }[]>`select identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
  await page.goto(`/api/auth/magic-link/verify?token=${row!.identifier}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("admin", () => {
  test("hidden from everyone but admins; disabling a user ends their session and is audited", async ({ browser }) => {
    const adminEmail = unique("admin");
    const userEmail = unique("user");
    const adminPage = await newPage(browser, "denied");
    const userPage = await newPage(browser, "denied");
    await signIn(adminPage, adminEmail);
    await signIn(userPage, userEmail);

    // Signed out and non-admins: plain 404, no admin link.
    expect((await (await newPage(browser)).goto("/admin"))?.status()).toBe(404);
    expect((await userPage.goto("/admin"))?.status()).toBe(404);
    await userPage.goto("/dashboard");
    await expect(userPage.getByRole("link", { name: "Quản trị" })).toHaveCount(0);

    // First admin comes from the CLI.
    const out = execFileSync(process.execPath, ["scripts/admin-grant.ts", adminEmail], { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL } }).toString();
    expect(out).toContain("is now an admin");

    await adminPage.goto("/dashboard");
    await adminPage.getByRole("link", { name: "Quản trị" }).click();
    await expect(adminPage).toHaveURL(/\/admin$/);
    await expect(adminPage.getByRole("img", { name: "Người dùng mới" })).toBeVisible();

    await adminPage.getByRole("link", { name: "Người dùng", exact: true }).click();
    await adminPage.getByLabel("Tìm theo email").fill(userEmail);
    await adminPage.getByRole("button", { name: "Tìm theo email" }).click();
    await adminPage.getByRole("link", { name: userEmail }).click();
    await adminPage.getByRole("button", { name: "Khoá tài khoản" }).click();
    await expect(adminPage.locator("[data-result=done]")).toBeVisible();
    await expect(adminPage.getByTestId("user-status")).toHaveText("disabled");

    await userPage.goto("/dashboard");
    await expect(userPage).toHaveURL(/\/login$/);

    await adminPage.getByRole("link", { name: "Nhật ký" }).click();
    await expect(adminPage.getByTestId("audit-log")).toContainText("user.disable");
    await expect(adminPage.getByTestId("audit-log")).toContainText(adminEmail);
  });
});

test.describe("analytics", () => {
  const eventsFor = (path: string) => sql<{ visitor_hash: string | null }[]>`select visitor_hash from analytics_events where path = ${path}`;

  test("consent banner; page views are anonymous until the visitor accepts", async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto("/terms");
    const banner = page.getByRole("dialog", { name: "Chính sách bảo mật" });
    await expect(banner).toBeVisible();
    await expect.poll(async () => (await eventsFor("/terms")).length).toBeGreaterThan(0);
    expect((await eventsFor("/terms")).every((e) => e.visitor_hash === null)).toBe(true);

    await banner.getByRole("button", { name: "Đồng ý" }).click();
    await expect(banner).toBeHidden();
    await page.goto("/privacy");
    await expect.poll(async () => (await eventsFor("/privacy")).some((e) => e.visitor_hash !== null)).toBe(true);
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Chính sách bảo mật" })).toHaveCount(0);
  });

  test("collect endpoint rejects other origins and strips query strings", async ({ request }) => {
    expect((await request.post("/api/analytics/collect", { data: '{"path":"/x"}', headers: { origin: "https://evil.test" } })).status()).toBe(403);
    const ok = await request.post("/api/analytics/collect", { data: '{"path":"/en/login?token=abc"}', headers: { "x-forwarded-for": "203.0.113.250" } });
    expect(ok.status()).toBe(204);
    expect(await sql`select 1 from analytics_events where path like '%token%'`).toHaveLength(0);
  });
});

test.describe("storage", () => {
  test("upload straight to storage, list, download, IDOR blocked, delete; disallowed type rejected", async ({ browser }) => {
    const owner = await newPage(browser, "denied");
    await signIn(owner, unique("files"));
    await owner.getByRole("link", { name: "Tệp" }).click();
    await expect(owner.getByText("Chưa có tệp nào.")).toBeVisible();

    await owner.locator("input[type=file]").setInputFiles({ name: "ghi chú.txt", mimeType: "text/plain", buffer: Buffer.from("xin chào") });
    const item = owner.getByTestId("file-list").getByRole("listitem").filter({ hasText: "ghi chú.txt" });
    await expect(item).toBeVisible();
    await expect(owner.getByTestId("storage-usage")).toContainText("8 B");

    const href = (await item.getByRole("link", { name: "Tải xuống" }).getAttribute("href"))!;
    const download = await owner.request.get(href);
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe("xin chào");

    const other = await newPage(browser, "denied");
    await signIn(other, unique("other"));
    expect((await other.request.get(href, { maxRedirects: 0 })).status()).toBe(404);

    await owner.locator("input[type=file]").setInputFiles({ name: "x.html", mimeType: "text/html", buffer: Buffer.from("<b>x</b>") });
    await expect(owner.getByRole("alert")).toHaveText("Loại tệp này không được hỗ trợ.");

    await item.getByRole("button", { name: "Xoá" }).click();
    await expect(owner.getByText("Chưa có tệp nào.")).toBeVisible();
    expect((await owner.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
  });
});
