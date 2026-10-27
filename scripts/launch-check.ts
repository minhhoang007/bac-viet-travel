// Checks a deployed site before launch: HTTPS, title/description/canonical, share image, security headers,
// robots.txt, sitemap, health check, legal pages, and (when EMAIL_FROM is set) the email DNS records.
// Manual items (payments, backups): docs/LAUNCH.md.
// Usage: pnpm launch:check https://example.com   (EMAIL_FROM from the environment, e.g. node --env-file)
import { resolveTxt } from "node:dns/promises";
import { checkEmailDns, checkLaunch, formatLaunch } from "./launch-check-lib";

const url = process.argv[2];
if (!url || !URL.canParse(url)) {
  console.error("Usage: pnpm launch:check https://your-domain.com");
  process.exit(1);
}

const results = await checkLaunch(url, (u) => fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15_000) }));
const from = process.env.EMAIL_FROM;
if (from) results.push(...(await checkEmailDns(from, async (name) => (await resolveTxt(name)).map((parts) => parts.join("")))));
else results.push({ ok: false, name: "EMAIL_FROM", detail: "not set: run with the production env to check email DNS" });
console.log(formatLaunch(results));
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
