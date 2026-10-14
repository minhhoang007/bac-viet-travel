import { clientKeyFrom } from "@/app/_lib/client-ip";
import { demoAccounts, getContainer } from "@/bootstrap/container";
import { getPublicEnv } from "@/bootstrap/env";
import { localePath } from "@/core/i18n/routing";
import { appConfig } from "@/config/app";

/**
 * Demo site (DEMO_MODE): the /demo form posts here; one click signs in as a demo staff account. A route handler, not
 * a server action: the answer is a real redirect to Better Auth's verify URL, which the browser must load in full
 * (a server action's redirect to a same-origin URL becomes a client navigation that never reaches the handler).
 */
export async function POST(request: Request): Promise<Response> {
  const { demoMode, NEXT_PUBLIC_SITE_URL } = getPublicEnv();
  const site = new URL(NEXT_PUBLIC_SITE_URL);
  const form = await request.formData();
  const locale = (appConfig.locales as readonly string[]).includes(String(form.get("locale"))) ? String(form.get("locale")) : appConfig.defaultLocale;
  const back = (result: string) => Response.redirect(new URL(`${localePath(locale, "/demo")}?result=${result}`, site), 303);
  // Same-site forms only (server actions get this check from Next.js; route handlers do not).
  if (request.headers.get("origin") !== site.origin) return new Response("Forbidden", { status: 403 });
  const account = demoAccounts().find((a) => a.email === String(form.get("email") ?? ""));
  const app = getContainer().app;
  if (!demoMode || !account || !app) return back("failed");
  // Each click issues a sign-in link and a demo email: a visitor clicking in a loop is slowed down.
  const limit = await getContainer().rateLimiter("demo-sign-in", { max: 20, windowMs: 10 * 60_000 }).limit(clientKeyFrom(request.headers));
  if (!limit.success) return back("rate_limited");
  const link = await app.auth.demoSignIn(account.email, localePath(locale, account.home), request.headers);
  return link ? Response.redirect(link, 303) : back("failed");
}
