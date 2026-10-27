// Pure part of `pnpm launch:check <url>` (see scripts/launch-check.ts): checks a deployed site the way a
// visitor, a search engine and a link preview see it. `fetch` is injected so tests need no network.

export type Fetch = (url: string) => Promise<{ status: number; headers: { get(name: string): string | null }; text(): Promise<string> }>;

export interface LaunchResult {
  ok: boolean;
  name: string;
  detail?: string;
}

const SECURITY_HEADERS = ["strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy"];

const meta = (html: string, attr: "name" | "property", key: string) =>
  html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${key}"`, "i"))?.[1];
/** Placeholder content (sample reviews, demo figures, template legal text) is marked data-demo and must be gone. */
const demoMarker = (html: string) => {
  const m = html.match(/\sdata-demo(?=[\s=>/])(?:=["']?([^"'\s>]*))?/i);
  return m ? `page has data-demo${m[1] ? ` ("${m[1]}")` : ""}: replace it with real content` : undefined;
};
const isLocal = (url: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

/** True when the `User-agent: *` group has `Disallow: /`. Blocking one bot (e.g. GPTBot) is a choice, not an error. */
function disallowsAllForEveryone(robots: string): boolean {
  let agents: string[] = [];
  let inRules = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [, field, value = ""] = line.match(/^([a-z-]+)\s*:\s*(.*)$/i) ?? [];
    if (!field) continue;
    if (field.toLowerCase() === "user-agent") {
      // Consecutive User-agent lines share one group; a User-agent after rules starts a new group.
      if (inRules) agents = [];
      inRules = false;
      agents.push(value.trim());
    } else {
      inRules = true;
      if (field.toLowerCase() === "disallow" && value.trim() === "/" && agents.includes("*")) return true;
    }
  }
  return false;
}

export async function checkLaunch(base: string, fetch: Fetch): Promise<LaunchResult[]> {
  const results: LaunchResult[] = [];
  const add = (ok: boolean, name: string, detail?: string) => results.push({ ok, name, ...(detail && { detail }) });
  const origin = new URL(base).origin;
  const get = async (path: string) => {
    try {
      const res = await fetch(new URL(path, origin).toString());
      return { status: res.status, headers: res.headers, body: await res.text() };
    } catch (error) {
      return { status: 0, headers: { get: () => null }, body: "", error: error instanceof Error ? error.message : String(error) };
    }
  };

  add(origin.startsWith("https://"), "HTTPS", origin.startsWith("https://") ? undefined : "use an https:// URL");

  const home = await get("/");
  add(home.status === 200, "Home page responds 200", home.status === 200 ? undefined : `got ${home.status || "no response"}`);
  if (home.status === 200) {
    const title = home.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    add(Boolean(title), "Title", title ?? "missing <title>");
    const description = meta(home.body, "name", "description");
    add(Boolean(description), "Meta description", description ? undefined : "missing");
    const canonical = home.body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i)?.[1];
    add(Boolean(canonical) && !isLocal(canonical!), "Canonical URL", canonical ?? "missing");
    const ogImage = meta(home.body, "property", "og:image");
    if (!ogImage || isLocal(ogImage)) {
      add(false, "Share image (og:image)", ogImage ?? "missing");
    } else {
      const image = await get(ogImage);
      const type = image.headers.get("content-type") ?? "";
      add(image.status === 200 && type.startsWith("image/"), "Share image (og:image)", image.status === 200 ? type : `got ${image.status}`);
    }
    const iconHref = home.body.match(/<link[^>]*rel="(?:shortcut )?icon"[^>]*href="([^"]*)"/i)?.[1];
    if (!iconHref) {
      add(false, "Favicon", "missing <link rel=\"icon\">");
    } else {
      const icon = await get(iconHref);
      add(icon.status === 200, "Favicon", icon.status === 200 ? undefined : `got ${icon.status}`);
    }
    const demo = demoMarker(home.body);
    add(!demo, "No demo content", demo);
    const missing = SECURITY_HEADERS.filter((h) => !home.headers.get(h));
    add(missing.length === 0, "Security headers", missing.length ? `missing ${missing.join(", ")}` : undefined);
  }

  const robots = await get("/robots.txt");
  const blocksAll = disallowsAllForEveryone(robots.body);
  add(robots.status === 200 && !blocksAll, "robots.txt", robots.status !== 200 ? `got ${robots.status}` : blocksAll ? "blocks the whole site" : undefined);

  const sitemap = await get("/sitemap.xml");
  const locs = [...sitemap.body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!);
  const foreign = locs.find((loc) => !loc.startsWith(origin));
  add(
    sitemap.status === 200 && locs.length > 0 && !foreign,
    "sitemap.xml",
    sitemap.status !== 200 ? `got ${sitemap.status}` : locs.length === 0 ? "no URLs" : foreign ? `URL on another host: ${foreign}` : `${locs.length} URLs`,
  );

  const health = await get("/api/health");
  add(health.status === 200, "Health check (/api/health)", health.status === 200 ? undefined : `got ${health.status || "no response"}`);

  for (const path of ["/terms", "/privacy"]) {
    const page = await get(path);
    const demo = page.status === 200 ? demoMarker(page.body) : undefined;
    add(page.status === 200 && !demo, `Legal page ${path}`, page.status === 200 ? demo : `got ${page.status}`);
  }
  return results;
}

/** DNS TXT lookup (records joined per entry); throws or returns [] when the name has none. Injected for tests. */
export type ResolveTxt = (name: string) => Promise<string[]>;

/** Domain of an EMAIL_FROM value such as `Tên <noreply@mail.example.com>` or `noreply@example.com`. */
export function emailDomain(from: string): string | undefined {
  return from.match(/@([a-z0-9.-]+\.[a-z]{2,})>?\s*$/i)?.[1]?.toLowerCase();
}

/** Email sending checks for EMAIL_FROM (Resend records, see docs/LAUNCH.md §2): own domain, DKIM, SPF, DMARC. */
export async function checkEmailDns(from: string, resolveTxt: ResolveTxt): Promise<LaunchResult[]> {
  const results: LaunchResult[] = [];
  const add = (ok: boolean, name: string, detail?: string) => results.push({ ok, name, ...(detail && { detail }) });
  const domain = emailDomain(from);
  if (!domain) return [{ ok: false, name: "EMAIL_FROM", detail: `no email address in "${from}"` }];
  if (domain === "resend.dev" || domain.endsWith(".resend.dev")) {
    return [{ ok: false, name: "EMAIL_FROM", detail: "resend.dev only delivers to the Resend account owner: verify your own domain" }];
  }
  add(true, "EMAIL_FROM", domain);
  const txt = async (name: string) => {
    try {
      return await resolveTxt(name);
    } catch {
      return [];
    }
  };

  const dkim = await txt(`resend._domainkey.${domain}`);
  add(dkim.some((r) => /\bp=/.test(r)), "Email DKIM", dkim.length ? undefined : `no TXT at resend._domainkey.${domain}`);

  // Resend puts SPF on the bounce subdomain `send.<domain>`; an SPF record on the domain itself also counts.
  const spf = [...(await txt(`send.${domain}`)), ...(await txt(domain))].filter((r) => r.startsWith("v=spf1"));
  add(spf.length > 0, "Email SPF", spf.length ? undefined : `no v=spf1 TXT at send.${domain} or ${domain}`);

  // DMARC may sit on the sending domain or on a parent (organizational) domain.
  const labels = domain.split(".");
  let dmarc: string | undefined;
  for (let i = 0; i < labels.length - 1 && !dmarc; i++) {
    dmarc = (await txt(`_dmarc.${labels.slice(i).join(".")}`)).find((r) => r.startsWith("v=DMARC1"));
  }
  add(Boolean(dmarc), "Email DMARC", dmarc ?? `no v=DMARC1 TXT at _dmarc.${domain} or a parent domain`);
  return results;
}

export function formatLaunch(results: LaunchResult[]): string {
  const failed = results.filter((r) => !r.ok).length;
  const lines = results.map((r) => `${r.ok ? "✔" : "✖"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  return `${lines.join("\n")}\n\n${failed === 0 ? "Ready to launch. Manual items: docs/LAUNCH.md" : `${failed} check(s) failed.`}`;
}
