// Project-owned E2E: tours CMS (P3). Marketing (editor) writes and submits; an admin publishes; visitors see it.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ mode: "serial" });

const EDITOR = "marketing@bacviet.example";
const ADMIN = "owner@bacviet.example";

// One session per person for the whole file: magic links are rate limited per email.
const sessions = new Map<string, Page>();

async function signIn(browser: Browser, email: string, role: "editor" | "admin"): Promise<Page> {
  const existing = sessions.get(email);
  if (existing) return existing;
  const page = await newSession(browser, email, role);
  sessions.set(email, page);
  return page;
}

async function newSession(browser: Browser, email: string, role: "editor" | "admin"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signInStaff(page, sql, email, role);
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

  // Search ignores accents and case: "NINH binh" finds the Ninh Bình tours only.
  await editor.goto("/admin/tours");
  await editor.getByLabel("Tìm theo tên hoặc đường dẫn").fill("NINH binh");
  await editor.getByRole("button", { name: "Tìm" }).click();
  await expect(editor.locator('[data-slug="ninh-binh-day-tour"]')).toBeVisible();
  await expect(editor.locator('[data-slug="sapa-trekking-2d1n"]')).toHaveCount(0);

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

test("an admin returns a tour with a note, schedules the fix, and restores an older version", async ({ browser }) => {
  const [row] = await sql<{ id: string }[]>`select id from content_items where slug = 'ninh-binh-e2e'`;
  const edit = `/admin/tours/${row!.id}`;
  const status = (page: Page) => page.locator("[data-status]").first();
  const editor = await signIn(browser, EDITOR, "editor");
  const admin = await signIn(browser, ADMIN, "admin");

  // Marketing changes the name and submits.
  await editor.goto(edit);
  await formReady(editor);
  await editor.getByRole("tab", { name: "Tiếng Việt" }).click();
  await panel(editor).getByLabel("Tên tour", { exact: true }).fill("Ninh Bình bản 3");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();
  await editor.getByRole("button", { name: "Gửi duyệt" }).click();
  await expect(status(editor)).toHaveAttribute("data-status", "pending");

  // The admin sends it back with a note; marketing sees the note on the tour.
  await admin.goto(edit);
  await admin.getByLabel("Cần sửa gì?").fill("Tên tour cần có số ngày.");
  await admin.getByRole("button", { name: "Trả lại để sửa" }).click();
  await expect(status(admin)).toHaveAttribute("data-status", "draft");
  await editor.goto(edit);
  await expect(editor.getByRole("note").filter({ hasText: "Tên tour cần có số ngày." })).toBeVisible();

  // Fixed and resubmitted; the admin schedules it for tomorrow. Visitors still see the live version.
  await formReady(editor);
  await editor.getByRole("tab", { name: "Tiếng Việt" }).click();
  await panel(editor).getByLabel("Tên tour", { exact: true }).fill("Ninh Bình 1 ngày bản 3");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();
  await editor.getByRole("button", { name: "Gửi duyệt" }).click();
  await expect(status(editor)).toHaveAttribute("data-status", "pending");

  await admin.goto(edit);
  const tomorrow = new Date(Date.now() + 24 * 3600_000 + 7 * 3600_000).toISOString().slice(0, 16); // Asia/Ho_Chi_Minh wall time
  await admin.getByLabel("Thời điểm công khai").fill(tomorrow);
  await admin.getByRole("button", { name: "Duyệt và hẹn giờ" }).click();
  await expect(status(admin)).toHaveAttribute("data-status", "approved");
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/tours/ninh-binh-e2e");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình bản nháp");

  // Time passes (moved in the database); the cron tick publishes it.
  await sql`update content_items set publish_at = now() - interval '1 minute' where id = ${row!.id}`;
  const tick = await visitor.request.post("/api/jobs/run", { headers: { authorization: `Bearer ${e2eServerEnv.CRON_SECRET}` } });
  expect(tick.status()).toBe(200);
  await admin.goto(edit);
  await expect(status(admin)).toHaveAttribute("data-status", "published");
  await expect(async () => {
    await visitor.goto("/tours/ninh-binh-e2e");
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình 1 ngày bản 3");
  }).toPass({ timeout: 15_000 });

  // Restoring the first published version copies it into the draft; the live tour waits for review.
  await admin.getByText("Lịch sử phiên bản").click();
  const dialog = admin.getByRole("dialog");
  const oldest = admin.locator("details li").last();
  await expect(async () => {
    if (!(await dialog.isVisible())) await oldest.getByRole("button", { name: "Khôi phục" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByRole("button", { name: "Khôi phục" }).click();
  await expect(status(admin)).toHaveAttribute("data-status", "draft");
  await formReady(admin);
  await admin.getByRole("tab", { name: "Tiếng Việt" }).click();
  await expect(panel(admin).getByLabel("Tên tour", { exact: true })).toHaveValue("Ninh Bình E2E");
  await expect(admin.getByLabel("Đường dẫn (slug)")).toHaveValue("ninh-binh-day-tour-copy");
  await visitor.goto("/tours/ninh-binh-e2e");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Ninh Bình 1 ngày bản 3");
});

test("text typed in the admin is shown as text: no code runs, no secret leaks", async ({ browser }) => {
  const [row] = await sql<{ id: string }[]>`select id from content_items where slug = 'ninh-binh-day-tour-copy'`;
  const editor = await signIn(browser, EDITOR, "editor");
  await editor.goto(`/admin/tours/${row!.id}`);
  await formReady(editor);
  await editor.getByRole("tab", { name: "Tiếng Việt" }).click();
  await panel(editor).getByLabel("Giới thiệu (Markdown)").fill('**Đón khách** {process.env.BETTER_AUTH_SECRET}\n\n<script>window.pwned=1</script>\n\n<Callout tone="warning">Mang áo ấm</Callout>');
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();

  await editor.goto(`/api/content/preview?id=${row!.id}&locale=vi`);
  await expect(editor.getByText("{process.env.BETTER_AUTH_SECRET}")).toBeVisible();
  expect(await editor.content()).not.toContain(e2eServerEnv.BETTER_AUTH_SECRET!);
  expect(await editor.evaluate(() => (window as { pwned?: number }).pwned)).toBeUndefined();
  await expect(editor.locator("strong", { hasText: "Đón khách" })).toBeVisible();
  await expect(editor.locator("aside", { hasText: "Mang áo ấm" })).toBeVisible();
  await editor.goto("/api/content/preview?exit=1&locale=vi");
});
