import { getSessionCookie } from "better-auth/cookies";

/** Optimistic check for proxy.ts: a session cookie exists. Never use as authorization. */
export function hasSessionCookie(request: Request): boolean {
  return Boolean(getSessionCookie(request));
}
