import { describe, expect, it } from "vitest";
import { checkLaunch, formatLaunch, type Fetch } from "./launch-check-lib";

const ORIGIN = "https://example.com";
const HOME = `<html><head><title>Example</title><meta name="description" content="A site">
<link rel="canonical" href="${ORIGIN}/"><link rel="icon" href="/icon?abc"><meta property="og:image" content="${ORIGIN}/api/og?title=x"></head></html>`;
const SECURE = {
  "strict-transport-security": "max-age=1",
  "content-security-policy": "default-src 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin",
};

type Page = { status?: number; body?: string; headers?: Record<string, string> };
function fakeFetch(pages: Record<string, Page>): Fetch {
  return async (url) => {
    const page = pages[new URL(url).pathname + new URL(url).search];
    if (!page) return { status: 404, headers: { get: () => null }, text: async () => "" };
    const headers = page.headers ?? {};
    return { status: page.status ?? 200, headers: { get: (n) => headers[n.toLowerCase()] ?? null }, text: async () => page.body ?? "" };
  };
}

const healthySite: Record<string, Page> = {
  "/": { body: HOME, headers: SECURE },
  "/api/og?title=x": { headers: { "content-type": "image/png" } },
  "/icon?abc": { headers: { "content-type": "image/png" } },
  "/robots.txt": { body: `User-Agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml` },
  "/sitemap.xml": { body: `<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/terms</loc></url></urlset>` },
  "/api/health": { body: '{"status":"ok"}' },
  "/terms": {},
  "/privacy": {},
};

describe("checkLaunch", () => {
  it("passes a healthy site", async () => {
    const results = await checkLaunch(ORIGIN, fakeFetch(healthySite));
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(formatLaunch(results)).toContain("Ready to launch");
  });

  it("catches the usual launch mistakes", async () => {
    const results = await checkLaunch(
      ORIGIN,
      fakeFetch({
        ...healthySite,
        "/": { body: HOME.replace(`${ORIGIN}/api/og`, "http://localhost:3000/api/og"), headers: {} },
        "/robots.txt": { body: "User-Agent: *\nDisallow: /" },
        "/sitemap.xml": { body: "<urlset><url><loc>http://localhost:3000/</loc></url></urlset>" },
        "/api/health": { status: 503 },
        "/privacy": { status: 404 },
      }),
    );
    expect(results.filter((r) => !r.ok).map((r) => r.name)).toEqual([
      "Share image (og:image)",
      "Security headers",
      "robots.txt",
      "sitemap.xml",
      "Health check (/api/health)",
      "Legal page /privacy",
    ]);
  });

  it("blocks a home page that still shows demo content (data-demo)", async () => {
    const results = await checkLaunch(ORIGIN, fakeFetch({ ...healthySite, "/": { body: HOME.replace("</head>", '</head><section data-demo="reviews">'), headers: SECURE } }));
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, name: "No demo content", detail: 'page has data-demo ("reviews"): replace it with real content' }]);
  });

  it("robots.txt: blocking one bot is fine, blocking everyone is not", async () => {
    const robots = async (body: string) =>
      (await checkLaunch(ORIGIN, fakeFetch({ ...healthySite, "/robots.txt": { body } }))).find((r) => r.name === "robots.txt")!.ok;
    expect(await robots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /")).toBe(true);
    expect(await robots("User-agent: *\nAllow: /\n\nUser-agent: CCBot\nDisallow: /")).toBe(true);
    expect(await robots("User-agent: Googlebot\nUser-agent: *\nDisallow: /   # maintenance")).toBe(false);
  });

  it("reports a missing or broken favicon", async () => {
    const favicon = async (pages: Record<string, Page>) => (await checkLaunch(ORIGIN, fakeFetch(pages))).find((r) => r.name === "Favicon");
    expect(await favicon({ ...healthySite, "/": { body: HOME.replace(/<link rel="icon"[^>]*>/, ""), headers: SECURE } })).toMatchObject({ ok: false, detail: 'missing <link rel="icon">' });
    expect(await favicon({ ...healthySite, "/icon?abc": { status: 404 } })).toMatchObject({ ok: false, detail: "got 404" });
  });

  it("reports an http URL and an unreachable site without throwing", async () => {
    const down: Fetch = async () => {
      throw new Error("ENOTFOUND");
    };
    const results = await checkLaunch("http://example.com", down);
    expect(results.find((r) => r.name === "HTTPS")?.ok).toBe(false);
    expect(results.find((r) => r.name === "Home page responds 200")?.detail).toBe("got no response");
  });
});
