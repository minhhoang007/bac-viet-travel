import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.describe.configure({ timeout: 120_000 });

// Saving used to redirect back to the editor: the page jumped to the top, every save added a history entry, and when
// someone else had saved meanwhile the text being written was replaced by theirs.
test("the post editor saves in place and never loses the text being written", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await signInStaff(page, sql, "inplace-writer@bacviet.example", "editor");
  await page.goto("/admin/posts");
  await page.locator('[data-testid="admin-posts"] tbody tr a').first().click();
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]+$/);
  const editorUrl = page.url();
  const body = page.getByLabel("Nội dung (Markdown)");
  await expect(page.getByTestId("markdown-toolbar")).toBeVisible();

  // Saved where the writer is: same address, same scroll, the next save works (new revision taken).
  await body.fill(`${await body.inputValue()}\n\nĐoạn một.`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const scrolled = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(page.getByTestId("save-result")).toHaveText("Đã lưu bản nháp.", { timeout: 15_000 });
  expect(page.url()).toBe(editorUrl);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  await body.fill(`${await body.inputValue()}\n\nĐoạn hai.`);
  await page.keyboard.press("Control+s");
  const id = editorUrl.split("/").pop()!;
  await expect
    .poll(async () => (await sql<{ body: string }[]>`select draft->>'body' as body from content_items where id = ${id}`)[0]!.body, { timeout: 15_000 })
    .toContain("Đoạn hai.");

  // Someone else saves first: this writer is told, and keeps every word.
  const other = await page.context().newPage();
  await other.goto(editorUrl);
  await other.getByLabel("Nội dung (Markdown)").fill("Bản của người khác.");
  await other.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(other.getByTestId("save-result")).toHaveText("Đã lưu bản nháp.", { timeout: 15_000 });
  await body.fill(`${await body.inputValue()}\n\nĐOẠN ĐANG VIẾT`);
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(page.getByTestId("save-result")).toContainText("người khác lưu", { timeout: 15_000 });
  await expect(body).toHaveValue(/ĐOẠN ĐANG VIẾT$/);

  // Back leaves the editor (saves add no history entries).
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/posts$/);
});
