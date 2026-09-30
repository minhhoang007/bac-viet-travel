export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

export interface RateLimitRule {
  /** Max requests per window. */
  max: number;
  windowMs: number;
}

/**
 * Fixed-window limiter kept in process memory. Fine for a single instance / small `site` deployments;
 * use a shared store (Upstash) when running several instances.
 */
export function createMemoryRateLimiter(rule: RateLimitRule, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    async limit(key) {
      const t = now();
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        w = { count: 0, resetAt: t + rule.windowMs };
        windows.set(key, w);
        if (windows.size > 10_000) {
          for (const [k, v] of windows) if (v.resetAt <= t) windows.delete(k);
        }
      }
      w.count += 1;
      return { success: w.count <= rule.max, remaining: Math.max(0, rule.max - w.count), resetAt: w.resetAt };
    },
  };
}

/**
 * Uses `primary` (e.g. Upstash) and falls back to `fallback` (in-memory) when the store fails,
 * so an outage neither crashes the caller nor removes rate limiting entirely.
 */
export function withFallback(primary: RateLimiter, fallback: RateLimiter, onError?: (error: unknown) => void): RateLimiter {
  return {
    async limit(key) {
      try {
        return await primary.limit(key);
      } catch (error) {
        onError?.(error);
        return fallback.limit(key);
      }
    },
  };
}
