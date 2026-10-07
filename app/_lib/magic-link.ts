import { getPublicEnv } from "@/bootstrap/env";

/** Better Auth's own one-time sign-in URL on this site (never another origin or path: no open redirect). */
export function isOwnMagicLink(link: string): boolean {
  try {
    const url = new URL(link);
    const site = new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL);
    return url.origin === site.origin && url.pathname === "/api/auth/magic-link/verify" && url.searchParams.has("token");
  } catch {
    return false;
  }
}
