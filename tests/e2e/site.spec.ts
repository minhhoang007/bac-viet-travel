// Project-owned E2E: Bac Viet Travel pages and content.
// Generic starter guarantees live in tests/e2e/starter.spec.ts (starter-owned, do not edit).
import AxeBuilder from "@axe-core/playwright";
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

test("home: tour search, trust strip, demo reviews marked for launch:check, guides, FAQ and the contact anchor", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("trust-strip").locator("li")).toHaveCount(4);
  // Sample reviews carry data-demo (launch:check blocks them) and say so on the page; no rating in structured data.
  const reviews = page.locator('[data-demo="reviews"]');
  await expect(reviews.getByTestId("review")).toHaveCount(3);
  await expect(reviews.getByText("Đánh giá minh hoạ", { exact: false })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('"@type":"FAQPage"'))).toBe(true);
  expect(ld.some((s) => s.includes("aggregateRating") || s.includes('"@type":"Review"'))).toBe(false);
  await expect(page.getByTestId("home-post")).toHaveCount(3);
  await page.getByRole("button", { name: "Khi nào phải thanh toán?" }).click();
  await expect(page.getByText("đặt cọc 30%", { exact: false })).toBeVisible();
  await expect(page.locator("#contact form")).toBeVisible();

  const search = page.getByRole("search", { name: "Tìm tour" });
  await search.getByLabel("Điểm đến").selectOption("sapa");
  await search.getByLabel("Số khách").fill("3");
  await search.getByRole("button", { name: "Tìm tour" }).click();
  await expect(page).toHaveURL(/\/tours\?destination=sapa&date=&guests=3$/);
});

test("English pages put WhatsApp first and show USD prices", async ({ page }) => {
  await page.goto("/en/tours");
  await expect(page.getByRole("navigation", { name: "Quick contact" }).locator("a").first()).toHaveAttribute("data-contact", "whatsapp");
  await expect(page.locator("[data-destination=sapa]").getByText("$95")).toBeVisible();
});

test("tours page lists every tour; tour page has itinerary, TouristTrip JSON-LD and prefilled WhatsApp", async ({ page }) => {
  await page.goto("/tours");
  // At least the two imported tours per destination (tours-admin.spec may publish a copy meanwhile: the list is regenerated on publish).
  for (const d of ["ha-long", "ninh-binh", "sapa"]) await expect(page.locator(`[data-destination=${d}] article`).nth(1)).toBeVisible();
  await page.locator("[data-destination=ha-long]").getByRole("link", { name: "Du thuyền Hạ Long 2 ngày 1 đêm" }).first().click();
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
  // The inquiry is a secondary option: folded under "Ask us before booking".
  await page.getByTestId("inquiry").getByText("Hỏi tư vấn trước khi đặt").click();
  const form = page.locator("#book form");
  await form.getByLabel("Họ tên").fill("Nguyễn Văn A");
  await form.getByLabel("Email", { exact: true }).and(form.locator("input[type=email]")).fill("not-an-email");
  await form.getByLabel("Số điện thoại / WhatsApp").fill("abc");
  await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(form.getByText("Email không hợp lệ.")).toBeVisible();
  await expect(form.getByText("Số điện thoại không hợp lệ.")).toBeVisible();
  await expect(form.getByText("Ngày không hợp lệ.")).toBeVisible(); // no date picked

  // Date picker: localized calendar, past days disabled, picked day submitted as YYYY-MM-DD.
  await form.getByLabel("Ngày khởi hành").click(); // the trigger is named by its <label>
  const calendar = page.getByRole("grid");
  await expect(calendar).toBeVisible();
  await expect(calendar.locator("button:disabled").first()).toBeVisible();
  await calendar.locator("button:not(:disabled)").last().click();
  await expect(form.locator("input[name=date]")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
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

test("tour gallery, mobile menu and accessibility (axe) on travel pages", async ({ page }) => {
  await page.goto("/tours/ha-long-cruise-2d1n");
  const gallery = page.getByTestId("gallery");
  await expect(gallery.locator("img")).toHaveCount(3);
  for (const path of ["/", "/tours", "/tours/ha-long", "/tours/ha-long-cruise-2d1n"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path}: ${v.id}`)).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByTestId("mobile-menu").getByRole("link", { name: "Sapa" }).click();
  await expect(page).toHaveURL(/\/tours\/sapa$/);
});

test("company block, About and policy pages: legal details from config/contact.ts in both languages", async ({ page }) => {
  await page.goto("/");
  const company = page.getByTestId("company-info");
  await expect(company).toContainText("MST");
  await expect(company).toContainText("Giấy phép kinh doanh lữ hành quốc tế");
  for (const [name, path, heading] of [
    ["Giới thiệu", "/about", "Giới thiệu Bắc Việt Travel"],
    ["Chính sách huỷ / hoàn tiền", "/cancellation", "Chính sách huỷ / hoàn tiền"],
    ["Chính sách thanh toán", "/payment", "Chính sách thanh toán"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  await expect(page.getByText("tiền cọc 30% giá tour")).toBeVisible(); // payment page: deposit rate from the booking rules
  await page.goto("/cancellation");
  await expect(page.getByText(/hoàn 100% tiền cọc/)).toBeVisible();

  await page.goto("/en/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Bắc Việt Travel");
  await expect(page.getByText("International tour operator licence").first()).toBeVisible();
});

test("tour filters: the home search lands on a filtered list; filters stay in the URL; destination pages list their tours", async ({ page }) => {
  await page.goto("/tours?destination=sapa&date=2026-11-02&guests=3");
  await expect(page.locator("[data-destination=sapa] article")).toHaveCount(2);
  await expect(page.locator("[data-destination]:not([data-destination=sapa]) article")).toHaveCount(0);
  await expect(page.getByTestId("tour-count")).toHaveText("2 tour · Ngày đi 02/11/2026 · 3 khách");
  // Tour links carry the chosen date and group size to the tour page.
  await expect(page.locator("[data-destination=sapa] article a").first()).toHaveAttribute("href", /\?date=2026-11-02&guests=3$/);

  const filters = page.getByRole("form", { name: "Lọc tour" });
  await filters.getByLabel("Điểm đến").selectOption("");
  await filters.getByLabel("Số ngày").selectOption("1");
  await filters.getByLabel("Sắp xếp").selectOption("price-asc");
  await filters.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page).toHaveURL(/duration=1/);
  await expect(page).toHaveURL(/sort=price-asc/);
  await expect(page).toHaveURL(/guests=3/);
  const prices = await page.locator("[data-destination] article .text-primary").allTextContents();
  const values = prices.map((p) => Number(p.replace(/\D/g, "")));
  expect(values.length).toBeGreaterThan(0);
  expect(values).toEqual([...values].sort((a, b) => a - b));
  // Clearing keeps the trip (date, group size) and drops the filters.
  await page.getByRole("link", { name: "Xoá bộ lọc" }).click();
  await expect(page).toHaveURL(/\/tours\?date=2026-11-02&guests=3$/);
  await expect(page.locator("[data-destination] article")).not.toHaveCount(values.length);

  await filters.getByLabel("Mức giá").selectOption("high");
  await filters.getByLabel("Số ngày").selectOption("1");
  await filters.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page.getByText("Chưa có tour phù hợp", { exact: false })).toBeVisible();

  const res = await page.goto("/tours/ha-long");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tour Vịnh Hạ Long");
  // Only this destination's tours (other test files may publish more tours elsewhere).
  await expect(page.locator("[data-destination=ha-long] article")).toHaveCount(2);
  await expect(page.locator("[data-destination]:not([data-destination=ha-long]) article")).toHaveCount(0);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('"@type":"ItemList"'))).toBe(true);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/tours/ha-long</loc>");
  await page.goto("/en/tours/sapa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sapa tours");
});

test("tour page: photo viewer, quick facts, departures with seats, the search's date and group size carried to booking", async ({ page }) => {
  const TOUR = "/tours/ninh-binh-day-tour";
  await page.goto(TOUR);
  await expect(page.getByTestId("tour-facts").locator("dt")).toHaveText(["Thời gian", "Khởi hành", "Quy mô đoàn", "Ngôn ngữ"]);
  await expect(page.getByTestId("booking-trust").locator("li")).toHaveCount(3);
  // Itinerary: day 1 open, the others folded.
  const days = page.getByTestId("itinerary").locator("details");
  await expect(days.first()).toHaveAttribute("open", "");

  // Photo viewer: opens on a photo, arrow keys move, Escape closes.
  await page.getByRole("button", { name: /^Xem \d+ ảnh$/ }).click();
  const viewer = page.getByRole("dialog", { name: "Ảnh tour" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText(/^Ảnh 1\/\d+$/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText(/^Ảnh 2\/\d+$/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // Departures: live seats; the date picked in the search is highlighted and preselected for booking.
  // Seats load in the browser (the page itself is static).
  await expect(page.getByTestId("tour-departures").locator("[data-loaded]")).toBeVisible();
  const rows = page.getByTestId("tour-departures").locator("[data-departure]");
  expect(await rows.count()).toBeGreaterThan(3);
  const bookable = rows.filter({ has: page.getByRole("link", { name: /^Chọn / }) });
  const date = (await bookable.nth(1).getAttribute("data-departure"))!;
  await page.goto(`${TOUR}?date=${date}&guests=3`);
  await expect(page.locator(`[data-departure="${date}"]`)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("book-online")).toHaveText(/^Đặt ngày /);
  await page.getByTestId("book-online").click();
  await expect(page).toHaveURL(/\/book\?d=[0-9a-f-]+&guests=3$/);
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await expect(page.getByLabel("Người lớn")).toHaveValue("3");
  await expect(page.getByTestId("departures").locator('button[aria-pressed="true"]')).toHaveCount(1);
});

test("tour page on a phone: booking bar at the bottom, contact buttons above it, no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tours/ha-long-cruise-2d1n");
  const bar = page.locator("[data-mobile-book-bar]");
  await expect(bar).toBeVisible();
  await expect(bar.getByTestId("mobile-book")).toHaveAttribute("href", /\/tours\/ha-long-cruise-2d1n\/book$/);
  const barBox = (await bar.boundingBox())!;
  const contactBox = (await page.getByRole("navigation", { name: "Liên hệ nhanh" }).boundingBox())!;
  expect(contactBox.y + contactBox.height).toBeLessThanOrEqual(barBox.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(bar).toBeHidden();
});

test("contact page: chat first per language, office with a map link, the form; About shows the licence; 404 suggests destinations", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Liên hệ Bắc Việt Travel");
  const channels = page.getByTestId("contact-channels").locator("a");
  await expect(channels).toHaveCount(4);
  await expect(channels.first()).toHaveAttribute("data-channel", "zalo");
  await expect(page.getByTestId("map-link")).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  await expect(page.locator("main form")).toBeVisible();
  await page.goto("/en/contact");
  await expect(page.getByTestId("contact-channels").locator("a").first()).toHaveAttribute("data-channel", "whatsapp");

  await page.goto("/about");
  await expect(page.getByTestId("licence")).toContainText("Giấy phép kinh doanh lữ hành quốc tế");
  await expect(page.getByRole("link", { name: "Liên hệ tư vấn" })).toHaveAttribute("href", "/contact");

  const res = await page.goto("/khong-ton-tai");
  expect(res?.status()).toBe(404);
  const suggestions = page.getByTestId("not-found-suggestions");
  await expect(suggestions.locator('a[href^="/tours/"]')).toHaveCount(3);
  await suggestions.getByRole("link", { name: "Xem tất cả tour" }).click();
  await expect(page).toHaveURL(/\/tours$/);

  for (const path of ["/contact", "/about", "/khong-ton-tai"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path}: ${v.id}`)).toEqual([]);
  }
});
