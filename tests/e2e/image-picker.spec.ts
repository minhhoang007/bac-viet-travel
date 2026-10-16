// Project-owned E2E: the image picker on a blog post's cover, against the real services (no fakes exist for them).
// Skipped without keys (CI). Locally the server reads .env.local; give the runner the same keys:
//   env $(grep -E "^(CLOUDINARY_|UNSPLASH_)" .env.local | xargs) pnpm exec playwright test tests/e2e/image-picker.spec.ts
// Uses about 3 Unsplash API calls (search, photo, download) per run: a demo key allows 50 an hour.
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

test.skip(!process.env.UNSPLASH_ACCESS_KEY || !process.env.CLOUDINARY_CLOUD_NAME, "needs Unsplash and Cloudinary keys (.env.local)");

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("an Unsplash photo picked as a post cover is hotlinked, its download counted, and its photographer credited", async ({ page }) => {
  test.setTimeout(120_000);
  await signInStaff(page, sql, "owner-picker@bacviet.example", "admin");
  await page.context().setExtraHTTPHeaders({}); // the helper's test header would reach the CDNs too (CORS)

  await page.goto("/admin/posts");
  await page.locator("main a[href*='/admin/posts/']").filter({ hasNotText: /mới|new/i }).first().click();
  const picker = page.getByTestId("picker-cover");
  await expect(picker).toBeVisible();
  // The free text field is gone: staff cannot paste an arbitrary URL.
  await expect(page.locator('input[name="cover"]')).toHaveAttribute("type", "hidden");

  await picker.getByRole("button", { name: /Chọn ảnh|Đổi ảnh/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Ảnh miễn phí (Unsplash)" }).click();
  await dialog.getByRole("textbox").fill("Ha Long Bay");
  await dialog.getByRole("button", { name: "Tìm" }).click();
  const first = dialog.getByRole("button", { name: /^Dùng ảnh này:/ }).first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  // The key never reaches the browser.
  expect(await page.content()).not.toContain(process.env.UNSPLASH_ACCESS_KEY!);
  await first.click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  const cover = await page.locator('input[name="cover"]').inputValue();
  expect(cover).toMatch(/^https:\/\/images\.unsplash\.com\//);
  await expect(picker.getByText(/^Ảnh: .+ \/ Unsplash$/)).toBeVisible();
  expect(await page.locator('input[name="coverCreditUrl"]').inputValue()).toMatch(/^https:\/\/unsplash\.com\/@.+utm_source=bac_viet_travel&utm_medium=referral$/);

  await page.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(page.getByText("Đã lưu", { exact: false }).first()).toBeVisible();
  // The preview (draft) shows the hotlinked cover with the credit and links.
  const preview = page.getByRole("link", { name: "Xem trước" });
  if (await preview.count()) {
    const [tab] = await Promise.all([page.context().waitForEvent("page"), preview.click()]);
    await expect(tab.getByTestId("cover-credit")).toContainText("Unsplash");
    await expect(tab.locator('img[src^="https://images.unsplash.com/"]').first()).toBeAttached();
  }
});

test("an Unsplash photo added to a tour shows on the tour page with its photographer credited", async ({ page }) => {
  test.setTimeout(120_000);
  await signInStaff(page, sql, "owner-picker-tour@bacviet.example", "admin");
  await page.context().setExtraHTTPHeaders({});

  await page.goto("/admin/tours");
  await page.locator('[data-slug="ninh-binh-2d1n"] a').first().click();
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByRole("tab", { name: "Ảnh" }).click();
  const chosen = page.getByRole("tabpanel").locator("fieldset > ul").first().locator("li");
  const before = await chosen.count();
  const search = page.getByTestId("tour-unsplash");
  await search.locator("summary").click();
  await search.getByRole("textbox").fill("Trang An Ninh Binh");
  await search.getByRole("button", { name: "Tìm" }).click();
  const first = search.getByRole("button", { name: /^Dùng ảnh này:/ }).first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  await first.click();
  await expect(chosen).toHaveCount(before + 1, { timeout: 30_000 });

  await page.getByRole("button", { name: "Lưu và đăng ngay" }).click();
  await page.waitForLoadState("networkidle");
  const credits = page.getByTestId("gallery-credits");
  await expect(async () => {
    await page.goto("/tours/ninh-binh-2d1n");
    await expect(credits).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(credits.locator('a[href^="https://unsplash.com/@"]').first()).toHaveAttribute("href", /utm_source=bac_viet_travel/);
});

test("an Unsplash photo inserted in a post's body shows with its caption crediting the photographer", async ({ page }) => {
  test.setTimeout(120_000);
  await signInStaff(page, sql, "owner-picker-body@bacviet.example", "admin");
  await page.context().setExtraHTTPHeaders({});
  await page.goto("/admin/posts");
  await page.locator("main a[href*='/admin/posts/']").filter({ hasNotText: /mới|new/i }).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByTestId("markdown-toolbar").getByRole("button", { name: "Chèn ảnh" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Ảnh miễn phí (Unsplash)" }).click();
  await dialog.getByRole("textbox").fill("Hanoi old quarter");
  await dialog.getByRole("textbox").press("Enter");
  const first = dialog.getByRole("button", { name: /^Dùng ảnh này:/ }).first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  await first.click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  const body = await page.getByLabel("Nội dung (Markdown)").inputValue();
  expect(body).toMatch(/!\[[^\]]*\]\(https:\/\/images\.unsplash\.com\/[^)]+\)\n\*Ảnh: \[[^\]]+\]\(https:\/\/unsplash\.com\/@[^)]+utm_source=bac_viet_travel[^)]*\) \/ \[Unsplash\]/);
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(page.getByText("Đã lưu", { exact: false }).first()).toBeVisible();
});
