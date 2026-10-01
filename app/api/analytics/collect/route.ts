import { getContainer } from "@/bootstrap/container";
import { getPublicEnv } from "@/bootstrap/env";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { hasConsent } from "@/components/analytics/consent";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";

// Per instance; page views are cheap, this only stops one client from flooding the table.
const limiter = createMemoryRateLimiter({ max: 60, windowMs: 60_000 });
const MAX_BODY = 2048;

/** Page-view beacon. Always 204 for accepted-or-ignored input, so it reveals nothing to scripts. */
export async function POST(request: Request): Promise<Response> {
  const { analytics, app, logger } = getContainer();
  if (!analytics) return new Response("Not found", { status: 404 });

  const site = new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const origin = request.headers.get("origin");
  if (origin && origin !== site.origin) return new Response(null, { status: 403 });

  const ip = clientKeyFrom(request.headers);
  if (!(await limiter.limit(`analytics:${ip}`)).success) return new Response(null, { status: 429 });

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: { path?: unknown; referrer?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof body.path !== "string") return new Response(null, { status: 400 });

  const consent = hasConsent(request.headers.get("cookie"));
  try {
    const user = consent && app ? await app.auth.getUser(request.headers) : null;
    await analytics.collect({
      path: body.path,
      referrer: typeof body.referrer === "string" ? body.referrer : null,
      ip,
      userAgent: request.headers.get("user-agent") ?? "",
      consent,
      userId: user?.id ?? null,
      siteHost: site.hostname,
    });
  } catch (error) {
    logger.error("analytics.collect_failed", { error });
  }
  return new Response(null, { status: 204 });
}
