// Project-owned E2E: post-trip feedback page (E4), opened from the signed link in the feedback email.
import { createHmac } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

const sign = (code: string) => createHmac("sha256", e2eServerEnv.BETTER_AUTH_SECRET!).update(`trip-feedback:${code}`).digest("base64url").slice(0, 32);

test("feedback: the guest rates the trip once from the signed link; a forged link is refused", async ({ page }) => {
  const [d] = await sql<{ id: string }[]>`select id from departures where tour_slug = 'ha-long-day-trip' order by date limit 1`;
  await sql`insert into bookings (code, token_hash, departure_id, status, hold_expires_at, deposit_paid_at, name, email, phone, locale, adults, seats, unit_price_vnd, total_vnd, deposit_vnd)
    values ('BV-FEED22', 'e2e', ${d!.id}, 'confirmed', now(), now(), 'Khách Đánh Giá', 'fb@example.com', '0900000003', 'vi', 1, 1, 1000000, 1000000, 300000)`;

  await page.goto(`/feedback/BV-FEED22?s=${"x".repeat(32)}`);
  await expect(page.locator("[data-feedback=not-found]")).toBeVisible();

  await page.goto(`/feedback/BV-FEED22?s=${sign("BV-FEED22")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chuyến đi của bạn thế nào?");
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByRole("radio", { name: /Tuyệt vời/ }).check();
  await page.getByLabel(/Điều bạn thích/).fill("Du thuyền sạch, đồ ăn ngon.");
  await page.getByTestId("feedback-send").click();
  await expect(page.locator("[data-feedback=saved]")).toContainText("đã nhận được");

  await page.goto(`/feedback/BV-FEED22?s=${sign("BV-FEED22")}`);
  await expect(page.locator("[data-feedback=saved]")).toContainText("đã gửi đánh giá");
  const [row] = await sql<{ rating: number }[]>`select f.rating from trip_feedback f join bookings b on b.id = f.booking_id where b.code = 'BV-FEED22'`;
  expect(row!.rating).toBe(5);
});
