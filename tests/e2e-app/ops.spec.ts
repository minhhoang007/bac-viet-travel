// Browser E2E for V1.2 ops modules: admin (+ audit log), analytics (consent), storage (direct upload to an
// S3-compatible server: the docker compose `storage` service locally, standing in for Cloudflare R2).
import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

let ipSeq = 150;
// Headless Chromium says "HeadlessChrome", which the analytics bot filter drops (as it should).
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0 Safari/537.36";
const newPage = async (browser: Browser, consent?: "granted" | "denied") => {
  const context = await browser.newContext({ userAgent, extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${ipSeq++}` } });
  if (consent) await context.addCookies([{ name: "analytics_consent", value: consent, url: "http://localhost:3200" }]);
  return context.newPage();
};
const unique = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const [row] = await sql<{ identifier: string }[]>`select regexp_replace(identifier, '^magic-link:', '') as identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
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

    // Editors (content staff) do not reach the starter's admin pages: users, jobs, money, audit.
    const asEditor = execFileSync(process.execPath, ["scripts/admin-grant.ts", userEmail, "--role", "editor"], { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL } }).toString();
    expect(asEditor).toContain("is now an editor");
    expect((await userPage.goto("/admin"))?.status()).toBe(404);
    expect((await userPage.goto("/admin/users"))?.status()).toBe(404);

    // First admin comes from the CLI.
    const out = execFileSync(process.execPath, ["scripts/admin-grant.ts", adminEmail], { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL } }).toString();
    expect(out).toContain("is now an admin");

    // Staff need a second factor: the admin area sends them to set one up first.
    await adminPage.goto("/dashboard");
    await adminPage.getByRole("link", { name: "Quản trị" }).click();
    await expect(adminPage).toHaveURL(/\/security\?setup=1$/);
    await expect(adminPage.getByTestId("security-passkeys")).toContainText("Chưa có passkey");

    // A passkey on this "device": Chrome's virtual authenticator with user verification (Face ID / PIN stand-in).
    const cdp = await adminPage.context().newCDPSession(adminPage);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    await adminPage.getByLabel("Tên (ví dụ: iPhone của Lan)").fill("Máy E2E");
    await adminPage.getByTestId("add-passkey").click();
    await expect(adminPage.getByRole("status")).toContainText("Đã lưu.");
    await expect(adminPage.getByTestId("security-passkeys")).toContainText("Máy E2E");

    // This session has not passed the second factor yet: verify with the passkey, then the admin area opens.
    await adminPage.goto("/admin");
    await expect(adminPage).toHaveURL(/\/verify$/);
    await adminPage.getByTestId("passkey-sign-in").click();
    await expect(adminPage).toHaveURL(/\/admin$/);
    await expect(adminPage.getByRole("img", { name: "Người dùng mới" })).toBeVisible();

    // Media and content modules are off in this app: their pages do not exist, even for admins.
    expect((await adminPage.goto("/admin/media"))?.status()).toBe(404);
    expect((await adminPage.goto("/admin/content"))?.status()).toBe(404);
    expect((await adminPage.request.get("/api/content/preview?id=x")).status()).toBe(404);
    await adminPage.goto("/admin");

    await adminPage.getByRole("link", { name: "Người dùng", exact: true }).click();
    await adminPage.getByLabel("Tìm theo email").fill(userEmail);
    await adminPage.getByRole("button", { name: "Tìm theo email" }).click();
    await adminPage.getByRole("link", { name: userEmail }).click();
    // The trigger is a client component: a click before hydration is lost (seen on CI), so click until the dialog opens.
    const dialog = adminPage.getByRole("dialog");
    await expect(async () => {
      if (!(await dialog.isVisible())) await adminPage.getByRole("button", { name: "Khoá tài khoản" }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await dialog.getByRole("button", { name: "Khoá tài khoản" }).click();
    await expect(adminPage.locator("[data-result=done]")).toBeVisible();
    await expect(adminPage.getByTestId("user-status")).toHaveText("disabled");

    await userPage.goto("/dashboard");
    await expect(userPage).toHaveURL(/\/login$/);

    await adminPage.getByRole("link", { name: "Nhật ký" }).click();
    await expect(adminPage.getByTestId("audit-log")).toContainText("user.disable");
    await expect(adminPage.getByTestId("audit-log")).toContainText(adminEmail);

    // Signed out, then back in with the passkey alone (no email): it counts as both factors, admin opens at once.
    await adminPage.context().clearCookies({ name: "better-auth.session_token" });
    await adminPage.goto("/login");
    await adminPage.getByTestId("passkey-sign-in").click();
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await adminPage.goto("/admin");
    await expect(adminPage).toHaveURL(/\/admin$/);

    // The security page lists the activity (sign-ins, the passkey) and this device.
    await adminPage.goto("/security");
    await expect(adminPage.getByTestId("security-activity")).toContainText("Thêm passkey");
    await expect(adminPage.locator('[data-device="current"]')).toBeVisible();
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

    await expect(owner.locator("input[type=file]")).toBeEnabled(); // hydrated (disabled in the server HTML)
    await owner.locator("input[type=file]").setInputFiles({ name: "ghi chú.txt", mimeType: "text/plain", buffer: Buffer.from("xin chào") });
    const item = owner.getByTestId("file-list").getByRole("listitem").filter({ hasText: "ghi chú.txt" });
    await expect(item).toBeVisible();
    await expect(owner.getByTestId("storage-usage")).toContainText("9 B") // "xin chào" is 9 bytes in UTF-8;

    const href = (await item.getByRole("link", { name: "Tải xuống" }).getAttribute("href"))!;
    const download = await owner.request.get(href);
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe("xin chào");

    const other = await newPage(browser, "denied");
    await signIn(other, unique("other"));
    expect((await other.request.get(href, { maxRedirects: 0 })).status()).toBe(404);

    await owner.locator("input[type=file]").setInputFiles({ name: "x.html", mimeType: "text/html", buffer: Buffer.from("<b>x</b>") });
    await expect(owner.locator("p[role=alert]")).toHaveText("Loại tệp này không được hỗ trợ.");

    await item.getByRole("button", { name: "Xoá" }).click();
    await expect(owner.getByText("Chưa có tệp nào.")).toBeVisible();
    expect((await owner.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
  });
});
