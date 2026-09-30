import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter, withFallback } from "./rate-limit";

describe("memory rate limiter", () => {
  it("blocks after max in a window and resets afterwards", async () => {
    let t = 0;
    const limiter = createMemoryRateLimiter({ max: 2, windowMs: 1000 }, () => t);

    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(false);
    expect((await limiter.limit("b")).success).toBe(true); // keys are independent

    t = 1000;
    expect(await limiter.limit("a")).toMatchObject({ success: true, remaining: 1, resetAt: 2000 });
  });
});

describe("withFallback", () => {
  it("uses the fallback limiter and reports the error when the primary store fails", async () => {
    const errors: unknown[] = [];
    const broken = { limit: async () => { throw new Error("upstash down"); } };
    const limiter = withFallback(broken, createMemoryRateLimiter({ max: 1, windowMs: 1000 }), (e) => errors.push(e));

    expect((await limiter.limit("k")).success).toBe(true);
    expect((await limiter.limit("k")).success).toBe(false); // still limited
    expect(errors).toHaveLength(2);
  });
});
