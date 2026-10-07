// Project-owned E2E (F8): every public page at phone and desktop width.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES: [path: string, status: number][] = [
  ["/", 200],
  ["/en", 200],
  ["/tours", 200],
  ["/tours?destination=sapa&guests=3", 200],
  ["/tours/sapa", 200],
  ["/en/tours/ha-long", 200],
  ["/tours/ninh-binh-day-tour", 200],
  ["/en/tours/ha-long-cruise-2d1n", 200],
  ["/tours/ninh-binh-day-tour/book", 200],
  ["/tours/ha-long-cruise-2d1n/book?type=private", 200],
  ["/blog", 200],
  ["/blog/kinh-nghiem-trekking-sapa", 200],
  ["/about", 200],
  ["/contact", 200],
  ["/faq", 200],
  ["/cancellation", 200],
  ["/khong-ton-tai", 404],
];

for (const [label, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
] as const) {
  test(`${label}: every public page responds, has one h1, no sideways scroll, images with alt, no serious axe issue`, async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await (await browser.newContext({ viewport })).newPage();
    const problems: string[] = [];
    for (const [path, status] of PAGES) {
      const res = await page.goto(path);
      if (res?.status() !== status) problems.push(`${path}: status ${res?.status()}`);
      // Some parts (the 404 body, streamed metadata) arrive after "load": wait for them before measuring.
      await page.locator("h1").first().waitFor().catch(() => {});
      await expect(page).toHaveTitle(/\S/).catch(() => {});
      const h1 = await page.locator("h1").count();
      if (h1 !== 1) problems.push(`${path}: ${h1} h1`);
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) problems.push(`${path}: horizontal scroll`);
      const noAlt = await page.locator("img:not([alt])").count();
      if (noAlt) problems.push(`${path}: ${noAlt} img without alt`);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      for (const v of violations.filter((v) => v.impact === "serious" || v.impact === "critical")) problems.push(`${path}: ${v.id} (${v.nodes.length})`);
    }
    expect(problems).toEqual([]);
  });
}
