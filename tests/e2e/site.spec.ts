// Project-owned E2E: Bac Viet Travel pages and content.
// Generic starter guarantees live in tests/e2e/starter.spec.ts (starter-owned, do not edit).
import { expect, test } from "@playwright/test";

test("home: destinations, featured tours, TravelAgency JSON-LD, quick contact (Zalo first in Vietnamese)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-destination-card]")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Tour được đặt nhiều" })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('"@type":"TravelAgency"'))).toBe(true);
  const contact = page.getByRole("navigation", { name: "Liên hệ nhanh" });
  await expect(contact.locator("a").first()).toHaveAttribute("data-contact", "zalo");
  await expect(contact.locator('[data-contact="zalo"]')).toHaveAttribute("href", /^https:\/\/zalo\.me\/\d+$/);
});

test("English pages put WhatsApp first and show USD prices", async ({ page }) => {
  await page.goto("/en/tours");
  await expect(page.getByRole("navigation", { name: "Quick contact" }).locator("a").first()).toHaveAttribute("data-contact", "whatsapp");
  await expect(page.locator("[data-destination=sapa]").getByText("$95")).toBeVisible();
});

test("tours page groups by destination; tour page has itinerary, TouristTrip JSON-LD and prefilled WhatsApp", async ({ page }) => {
  await page.goto("/tours");
  for (const d of ["ha-long", "ninh-binh", "sapa"]) await expect(page.locator(`section[data-destination=${d}] article`)).toHaveCount(2);
  await page.locator("section[data-destination=ha-long]").getByRole("link", { name: "Du thuyền Hạ Long 2 ngày 1 đêm" }).first().click();
  await expect(page).toHaveURL(/\/tours\/ha-long-cruise-2d1n$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Du thuyền Hạ Long 2 ngày 1 đêm");
  await expect(page.getByTestId("itinerary").locator("li")).toHaveCount(2);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('"@type":"TouristTrip"') && s.includes('"priceCurrency":"VND"'))).toBe(true);
  const wa = await page.locator("#book").getByRole("link", { name: "WhatsApp" }).getAttribute("href");
  expect(decodeURIComponent(wa!)).toContain("Du thuyền Hạ Long 2 ngày 1 đêm");
});

test("inquiry form validates on the server and keeps the visitor on the page", async ({ page }) => {
  await page.goto("/tours/sapa-trekking-2d1n");
  const form = page.locator("#book form");
  await form.getByLabel("Họ tên").fill("Nguyễn Văn A");
  await form.getByLabel("Email", { exact: true }).and(form.locator("input[type=email]")).fill("not-an-email");
  await form.getByLabel("Số điện thoại / WhatsApp").fill("abc");
  await form.getByLabel("Ngày khởi hành").fill("2020-01-01");
  await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(form.getByText("Email không hợp lệ.")).toBeVisible();
  await expect(form.getByText("Số điện thoại không hợp lệ.")).toBeVisible();
  await expect(form.getByText("Vui lòng chọn ngày từ hôm nay trở đi.")).toBeVisible();
});

test("blog posts link their translation; sitemap lists tours and posts; unknown tour is 404", async ({ page, request }) => {
  await page.goto("/blog/kinh-nghiem-trekking-sapa");
  await page.getByRole("link", { name: "Đọc bằng tiếng Anh" }).click();
  await expect(page).toHaveURL(/\/en\/blog\/sapa-trekking-guide$/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/tours/ninh-binh-day-tour");
  expect(sitemap).toContain("/en/blog/ha-long-bay-travel-guide");
  expect((await request.get("/tours/khong-co")).status()).toBe(404);
});

test("photo credits page links every Unsplash photographer", async ({ page }) => {
  await page.goto("/credits");
  await expect(page.locator('a[href^="https://unsplash.com/@"]')).toHaveCount(9);
});
