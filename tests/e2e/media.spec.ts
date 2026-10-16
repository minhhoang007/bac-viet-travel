// Project-owned E2E: the media library in the tour editor, against the real Cloudinary account (there is no fake
// provider). Skipped without keys (CI). Locally: the server reads .env.local; give the runner the same keys (they reach the server too):
//   env $(grep "^CLOUDINARY_" .env.local | xargs) pnpm exec playwright test tests/e2e/media.spec.ts
// It uploads one photo to the account (public/tours/sapa-3.jpg) each run.
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

test.skip(!process.env.CLOUDINARY_CLOUD_NAME, "needs Cloudinary keys (.env.local)");

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("a photo uploaded in the tour's Images tab is added, published and served from the CDN to visitors", async ({ page }) => {
  test.setTimeout(120_000);
  await signInStaff(page, sql, "owner-media@bacviet.example", "admin");
  // The helper's per-test client IP header would go to Cloudinary too, which refuses it (CORS).
  await page.context().setExtraHTTPHeaders({});

  await page.goto("/admin/tours");
  await page.locator('[data-slug="sapa-trekking-2d1n"] a').first().click();
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByRole("tab", { name: "Ảnh" }).click();
  const library = page.getByTestId("image-library");
  await library.locator('input[type="file"]').setInputFiles("public/tours/sapa-3.jpg");
  const thumbs = library.getByRole("button", { name: /^Thêm ảnh:/ });
  await expect(thumbs.first()).toBeVisible({ timeout: 60_000 });

  const chosen = page.getByRole("tabpanel").locator("fieldset > ul").first().locator("li");
  const before = await chosen.count();
  await thumbs.first().click();
  await expect(chosen).toHaveCount(before + 1);
  await page.getByRole("button", { name: "Lưu và đăng ngay" }).click();
  await page.waitForLoadState("networkidle");

  // The tour pages are cached and revalidated on publish; other files publishing tours at the same time can delay it.
  const cdn = page.locator('img[src*="res.cloudinary.com"], img[srcset*="res.cloudinary.com"]');
  await expect(async () => {
    await page.goto("/tours/sapa-trekking-2d1n");
    await expect(cdn.first()).toBeAttached({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  // Lazy-loaded further down the gallery: ask the CDN directly that the image is there.
  const src = await cdn.first().evaluate((img: HTMLImageElement) => img.src);
  const image = await page.request.get(src);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toMatch(/^image\//);
});
