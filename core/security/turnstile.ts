/**
 * Cloudflare Turnstile check (bot protection on the sign-in form), when TURNSTILE_SECRET_KEY is set. A network error
 * or timeout lets the request through: the rate limits still apply, and sign-in must not depend on Cloudflare.
 */
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileCheck = (token: string | null | undefined, remoteIp?: string) => Promise<boolean>;

export function createTurnstileCheck(secretKey: string, fetchImpl: typeof fetch = fetch, timeoutMs = 5_000): TurnstileCheck {
  return async (token, remoteIp) => {
    if (!token || token.length > 2048) return false;
    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    try {
      const res = await fetchImpl(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) return true;
      const data = (await res.json()) as { success?: boolean };
      return data.success === true;
    } catch {
      return true;
    }
  };
}
