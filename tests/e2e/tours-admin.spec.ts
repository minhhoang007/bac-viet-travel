// Project-owned E2E: tours CMS (P3). Marketing (editor) writes and submits; an admin publishes; visitors see it.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ mode: "serial" });

const EDITOR = "marketing@bacviet.example";
const ADMIN = "owner@bacviet.example";
let ip = 40;

async function signIn(browser: Browser, email: string, role: "editor" | "admin"): Promise<Page> {
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${ip++}` } })).newPage();
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  let token: string | undefined;
  for (let i = 0; i < 30 && !token; i++) {
    [{ identifier: token } = { identifier: undefined }] = await sql<{ identifier: string }[]>`
      select regexp_replace(identifier, '^magic-link:', '') as identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
    if (!token) await new Promise((r) => setTimeout(r, 300));
  }
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await sql`update users set role = ${role} where email = ${email}`;
  return page;
}

const panel = (page: Page) => page.getByRole("tabpanel");
/** The tour form is interactive only after hydration (tabs, lists). */
const formReady = (page: Page) => expect(page.locator("form[data-hydrated]")).toBeVisible();

test("marketing duplicates and edits a tour, submits it; an admin publishes; visitors see it", async ({ browser }) => {
  const editor = await signIn(browser, EDITOR, "editor");
  await editor.goto("/admin/tours");
  await expect(editor.getByTestId("admin-tours").locator("tbody tr")).toHaveCount(6);
  // The admin has its own shell: no public header, footer or floating contact buttons.
  await expect(editor.getByRole("navigation", { name: "Menu chính" })).toHaveCount(0);
  await expect(editor.locator("footer")).toHaveCount(0);
  await expect(editor.getByRole("link", { name: /Zalo/ })).toHaveCount(0);
  // Content pages only: no bookings menu, and the page itself is a 404 for editors.
  await expect(editor.getByRole("link", { name: "Đơn đặt tour" })).toHaveCount(0);
  expect((await editor.goto("/admin/bookings"))?.status()).toBe(404);

  await editor.goto("/admin/tours");
  await editor.locator('[data-slug="ninh-binh-day-tour"]').getByRole("button", { name: "Nhân bản" }).click();
  await expect(editor.getByText("Đã nhân bản.", { exact: false })).toBeVisible();
  const editUrl = editor.url();
  await formReady(editor);

  await editor.getByRole("tab", { name: "Tiếng Việt" }).click();
  await panel(editor).getByLabel("Tên tour", { exact: true }).fill("Ninh Bình E2E");
  await editor.getByRole("tab", { name: "English" }).click();
  await panel(editor).getByLabel("Tên tour", { exact: true }).fill("Ninh Binh E2E");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();
  await formReady(editor);
  // Saving kept the tab and the data.
  await expect(editor.getByRole("tab", { name: "English" })).toHaveAttribute("aria-selected", "true");
  await expect(panel(editor).getByLabel("Tên tour", { exact: true })).toHaveValue("Ninh Binh E2E");

  await expect(editor.getByRole("button", { name: "Duyệt và công khai ngay" })).toHaveCount(0);
  await editor.getByRole("button", { name: "Gửi duyệt" }).click();
  await expect(editor.locator("[data-status]").first()).toHaveAttribute("data-status", "pending");
  expect((await editor.goto("/tours/ninh-binh-day-tour-copy"))?.status()).toBe(404);

  const admin = await signIn(browser, ADMIN, "admin");
  await admin.goto(editUrl);
  await admin.getByRole("button", { name: "Duyệt và công khai ngay" }).first().click();
  await expect(admin.locator("[data-status]").first()).toHaveAttribute("data-status", "published");

  // The tours cache is revalidated on publish (stale-while-revalidate: may take one more request).
  await expect(async () => {
    const res = await admin.goto("/tours/ninh-binh-day-tour-copy");
    expect(res?.status()).toBe(200);
    await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình E2E");
  }).toPass({ timeout: 15_000 });
  await admin.goto("/en/tours/ninh-binh-day-tour-copy");
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Ninh Binh E2E");
});

test("an incomplete new tour lists what is missing and cannot be submitted", async ({ browser }) => {
  const editor = await signIn(browser, EDITOR, "editor");
  await editor.goto("/admin/tours/new");
  await editor.getByLabel("Tên tour (tiếng Việt)").fill("Hà Giang 3 ngày");
  await editor.getByLabel("Đường dẫn (slug)").fill("ha-giang-3-ngay");
  await editor.getByRole("button", { name: "Tạo bản nháp" }).click();
  await expect(editor.getByText("Đã tạo bản nháp.", { exact: false })).toBeVisible();
  await expect(editor.getByTestId("tour-problems")).toContainText("Chung › Điểm đến");

  await editor.getByRole("button", { name: "Gửi duyệt" }).click();
  await expect(editor.getByRole("alert").filter({ hasText: "chưa đủ để gửi duyệt" })).toBeVisible();
  await expect(editor.locator("[data-status]").first()).toHaveAttribute("data-status", "draft");

  // A slug can only be used once.
  await editor.goto("/admin/tours/new");
  await editor.getByLabel("Tên tour (tiếng Việt)").fill("Trùng");
  await editor.getByLabel("Đường dẫn (slug)").fill("ha-giang-3-ngay");
  await editor.getByRole("button", { name: "Tạo bản nháp" }).click();
  await expect(editor.getByRole("alert").filter({ hasText: "Đường dẫn này đã có tour khác dùng." })).toBeVisible();

  for (const path of ["/admin/tours", editor.url().replace(/\/new.*$/, "")]) {
    await editor.goto(path);
    const result = await new AxeBuilder({ page: editor }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path}: ${v.id}`)).toEqual([]);
  }
  const [row] = await sql<{ id: string }[]>`select id from content_items where slug = 'ha-giang-3-ngay'`;
  // Previewing the incomplete draft lists the missing fields in form words.
  await editor.goto(`/api/content/preview?id=${row!.id}&locale=vi`);
  await expect(editor).toHaveURL(/\/tours\/ha-giang-3-ngay$/);
  await expect(editor.getByRole("status").filter({ hasText: "Đang xem trước bản nháp" })).toBeVisible();
  await expect(editor.getByText("Chung › Điểm đến")).toBeVisible();
  await editor.goto("/api/content/preview?exit=1&locale=vi");

  await editor.goto(`/admin/tours/${row!.id}`);
  const result = await new AxeBuilder({ page: editor }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("marketing previews a draft on the tour page; a renamed tour redirects its old URL; the SEO title is used", async ({ browser }) => {
  const [row] = await sql<{ id: string }[]>`select id from content_items where slug = 'ninh-binh-day-tour-copy'`;
  const editor = await signIn(browser, EDITOR, "editor");
  await editor.goto(`/admin/tours/${row!.id}`);
  await formReady(editor);
  await editor.getByLabel("Đường dẫn (slug)").fill("ninh-binh-e2e");
  await editor.getByRole("tab", { name: "Tiếng Việt" }).click();
  await panel(editor).getByLabel("Tên tour", { exact: true }).fill("Ninh Bình bản nháp");
  await editor.getByRole("tab", { name: "SEO" }).click();
  await panel(editor).getByLabel("Tiêu đề trên Google").first().fill("Ninh Bình 1 ngày giá tốt");
  await expect(panel(editor).getByLabel("Hiển thị trên Google (ước lượng)").first()).toContainText("Ninh Bình 1 ngày giá tốt");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();

  // Preview: the working copy on the real page, with a banner; visitors still see the live tour.
  await editor.goto(`/api/content/preview?id=${row!.id}&locale=vi`);
  await expect(editor).toHaveURL(/\/tours\/ninh-binh-e2e$/);
  await expect(editor.getByRole("status").filter({ hasText: "Đang xem trước bản nháp" })).toBeVisible();
  await expect(editor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình bản nháp");
  // No booking or inquiry on a draft.
  await expect(editor.getByTestId("preview-no-booking")).toBeVisible();
  await expect(editor.getByTestId("book-online")).toHaveCount(0);
  // Still in preview, the old URL shows the live copy without a "draft" banner (the draft moved to the new URL).
  await editor.goto("/tours/ninh-binh-day-tour-copy");
  await expect(editor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình E2E");
  await expect(editor.getByRole("status").filter({ hasText: "Đang xem trước" })).toHaveCount(0);
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/tours/ninh-binh-day-tour-copy");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình E2E");
  await expect(visitor.getByRole("status").filter({ hasText: "Đang xem trước" })).toHaveCount(0);
  expect((await visitor.goto("/tours/ninh-binh-e2e"))?.status()).toBe(404);
  await editor.goto(`/api/content/preview?exit=1&locale=vi`);
  await editor.goto("/tours/ninh-binh-day-tour-copy");
  await expect(editor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình E2E");

  const admin = await signIn(browser, ADMIN, "admin");
  await admin.goto(`/admin/tours/${row!.id}`);
  await admin.getByRole("button", { name: "Duyệt và công khai ngay" }).first().click();
  await expect(admin.locator("[data-status]").first()).toHaveAttribute("data-status", "published");

  await expect(async () => {
    const res = await visitor.request.get("/tours/ninh-binh-day-tour-copy", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toMatch(/\/tours\/ninh-binh-e2e$/);
  }).toPass({ timeout: 15_000 });
  await visitor.goto("/tours/ninh-binh-day-tour-copy");
  await expect(visitor).toHaveURL(/\/tours\/ninh-binh-e2e$/);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình bản nháp");
  await expect(visitor).toHaveTitle(/Ninh Bình 1 ngày giá tốt/);
  // English: no SEO title, the tour name is used.
  await visitor.goto("/en/tours/ninh-binh-e2e");
  await expect(visitor).toHaveTitle(/Ninh Binh E2E/);
});
