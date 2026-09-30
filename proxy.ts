import createMiddleware from "next-intl/middleware";
import { routing } from "@/core/i18n/routing";

// Locale routing only. Never do auth/DB work here (AGENTS.md).
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\..*).*)",
};
