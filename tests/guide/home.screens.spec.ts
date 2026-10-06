// Review screenshots of the home page (desktop and phone), written to the scratch folder given in SHOTS_DIR.
import { test } from "@playwright/test";

const out = process.env.SHOTS_DIR ?? "test-results/shots";

for (const [path, slug] of [["/", "home"], ["/tours?destination=sapa&guests=3", "tours"], ["/tours/ha-long", "destination"]] as const)
for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test(`${slug} ${name}`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport })).newPage();
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    });
    await page.screenshot({ path: `${out}/${slug}-${name}.png`, fullPage: name === "desktop" });
  });
}
