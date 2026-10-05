import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { hasSessionCookie } from "@/core/auth/adapters/cookies";
import { routing, localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";
import { features } from "@/config/features";

const intl = createMiddleware(routing);
const PROTECTED = /^\/(?:(vi|en)\/)?dashboard(?:\/|$)/;

// Locale routing + an optimistic redirect for signed-out visitors of /dashboard.
// This is NOT authorization: pages still call requirePageUser() (AGENTS.md).
export default function proxy(request: NextRequest) {
  // Profile "site" has no login page: /dashboard falls through to a plain 404.
  const match = features.profile === "app" ? request.nextUrl.pathname.match(PROTECTED) : null;
  if (match && !hasSessionCookie(request)) {
    const locale = match[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(localePath(locale, authConfig.signInPath), request.url));
  }
  return intl(request);
}

export const config = {
  // `icon$`: the generated favicon (app/icon.tsx) is served at /icon, without a locale.
  matcher: "/((?!api|_next|_vercel|icon$|.*\\..*).*)",
};
