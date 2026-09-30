import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { hasSessionCookie } from "@/core/auth/adapters/cookies";
import { routing, localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";

const intl = createMiddleware(routing);
const PROTECTED = /^\/(?:(vi|en)\/)?dashboard(?:\/|$)/;

// Locale routing + an optimistic redirect for signed-out visitors of /dashboard.
// This is NOT authorization: pages still call requirePageUser() (AGENTS.md).
export default function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(PROTECTED);
  if (match && !hasSessionCookie(request)) {
    const locale = match[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(localePath(locale, authConfig.signInPath), request.url));
  }
  return intl(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
