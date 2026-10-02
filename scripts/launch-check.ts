// Checks a deployed site before launch: HTTPS, title/description/canonical, share image, security headers,
// robots.txt, sitemap, health check, legal pages. Manual items (DNS, payments, backups): docs/LAUNCH.md.
// Usage: pnpm launch:check https://example.com
import { checkLaunch, formatLaunch } from "./launch-check-lib";

const url = process.argv[2];
if (!url || !URL.canParse(url)) {
  console.error("Usage: pnpm launch:check https://your-domain.com");
  process.exit(1);
}

const results = await checkLaunch(url, (u) => fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15_000) }));
console.log(formatLaunch(results));
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
