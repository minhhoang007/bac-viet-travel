import type { RateLimiter, RateLimitRule } from "@/core/security/rate-limit";

/**
 * Fixed-window limiter on Upstash Redis REST (no SDK). INCR + PEXPIRE NX in one pipeline,
 * so the window starts on the first request and concurrent requests count atomically.
 */
export function upstashRateLimiter(
  options: { url: string; token: string; prefix?: string; fetch?: typeof fetch },
  rule: RateLimitRule,
): RateLimiter {
  const doFetch = options.fetch ?? fetch;
  const prefix = options.prefix ?? "rl";

  return {
    async limit(key) {
      const redisKey = `${prefix}:${key}`;
      const res = await doFetch(`${options.url.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["PEXPIRE", redisKey, String(rule.windowMs), "NX"],
          ["PTTL", redisKey],
        ]),
      });
      if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
      const [incr, , pttl] = (await res.json()) as { result: number }[];
      const count = incr?.result ?? Number.POSITIVE_INFINITY;
      const ttl = pttl && pttl.result > 0 ? pttl.result : rule.windowMs;
      return { success: count <= rule.max, remaining: Math.max(0, rule.max - count), resetAt: Date.now() + ttl };
    },
  };
}
