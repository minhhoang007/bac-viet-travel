/**
 * Client identifier for rate limiting. Trusts X-Forwarded-For, which Vercel overwrites with the real client IP;
 * other hosts must configure their proxy to do the same (docs/DEPLOY.md).
 */
export function clientKeyFrom(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
