// Screenshots of the marketing guide (docs/HUONG-DAN-MARKETING.md) on the E2E database with the imported tours.
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "../e2e/server-env";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ mode: "serial" });

const OUT = "docs/huong-dan/";
async function shot(target: Page | Locator, name: string) {
  const page = "page" in target ? target.page() : target;
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
  await target.screenshot({ path: `${OUT}${name}.png` });
}

async function signIn(browser: Browser, email: string, role: "editor" | "admin", ip: number): Promise<Page> {
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${ip}` } })).newPage();
  await page.goto("/login");
  await page.fill("#login-email", email);
  if (role === "editor") await shot(page, "01-dang-nhap");
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

const ready = (page: Page) => expect(page.locator("form[data-hydrated]")).toBeVisible();
const panel = (page: Page) => page.getByRole("tabpanel");

test("guide screenshots", async ({ browser }) => {
  test.setTimeout(120_000);
  const editor = await signIn(browser, "marketing@bacviet.example", "editor", 90);

  await editor.goto("/admin/tours");
  await shot(editor, "02-danh-sach-tour");

  await editor.goto("/admin/tours/new");
  await editor.getByLabel("Tên tour (tiếng Việt)").fill("Hà Giang 3 ngày 2 đêm");
  await editor.getByLabel("Đường dẫn (slug)").fill("ha-giang-3-ngay-2-dem");
  await shot(editor, "03-tao-tour");
  await editor.getByRole("button", { name: "Tạo bản nháp" }).click();
  await ready(editor);
  await shot(editor, "04-con-thieu");

  // A complete tour to show the tabs: duplicate an imported one.
  await editor.goto("/admin/tours");
  await editor.locator('[data-slug="ha-long-cruise-2d1n"]').getByRole("button", { name: "Nhân bản" }).click();
  await ready(editor);
  await shot(editor, "05-nhan-ban");
  for (const [tab, name] of [["Tiếng Việt", "06-tab-tieng-viet"], ["Ảnh", "08-tab-anh"], ["Tour riêng", "09-tab-tour-rieng"]] as const) {
    await editor.getByRole("tab", { name: tab }).click();
    await shot(editor, name);
  }
  await editor.getByRole("tab", { name: "SEO" }).click();
  await panel(editor).getByLabel("Tiêu đề trên Google").first().fill("Du thuyền Hạ Long 2 ngày 1 đêm, ngủ đêm trên vịnh");
  await panel(editor).getByLabel("Mô tả trên Google").first().fill("Ngủ đêm trên vịnh Hạ Long, chèo kayak hang Luồn, ngắm bình minh trên boong. Đón tận nơi ở Hà Nội, giá trọn gói.");
  await shot(editor, "07-tab-seo");
  await editor.getByRole("tab", { name: "Tiếng Việt" }).click();
  await panel(editor).getByLabel("Tên tour", { exact: true }).fill("Du thuyền Hạ Long 2 ngày 1 đêm (mới)");
  await editor.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(editor.getByText("Đã lưu bản nháp.")).toBeVisible();
  await shot(editor.locator("aside"), "10-quy-trinh");
  const edit = new URL(editor.url()).pathname;

  const id = edit.split("/").pop()!;
  await editor.goto(`/api/content/preview?id=${id}&locale=vi`);
  await expect(editor.getByRole("status").filter({ hasText: "Đang xem trước" })).toBeVisible();
  await shot(editor, "11-xem-truoc");
  await editor.goto("/api/content/preview?exit=1&locale=vi");

  await editor.goto(edit);
  await editor.getByRole("button", { name: "Gửi duyệt" }).click();
  await expect(editor.locator("[data-status]").first()).toHaveAttribute("data-status", "pending");

  const admin = await signIn(browser, "owner@bacviet.example", "admin", 91);
  await admin.goto(edit);
  await admin.getByLabel("Cần sửa gì?").fill("Thêm giờ đón khách ở phần Khởi hành.");
  await shot(admin.locator("aside"), "12-duyet");
  await admin.getByRole("button", { name: "Trả lại để sửa" }).click();
  await expect(admin.locator("[data-status]").first()).toHaveAttribute("data-status", "draft");

  await editor.goto(edit);
  await shot(editor.locator("aside"), "13-bi-tra-lai");
});
