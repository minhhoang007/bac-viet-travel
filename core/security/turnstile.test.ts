import { describe, expect, it, vi } from "vitest";
import { createTurnstileCheck } from "./turnstile";

const answer = (body: unknown, ok = true) => vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 503 }));

describe("Turnstile check", () => {
  it("passes a token Cloudflare accepts, sending the secret and client IP", async () => {
    const fetchImpl = answer({ success: true });
    expect(await createTurnstileCheck("secret", fetchImpl)("token", "1.2.3.4")).toBe(true);
    const body = (fetchImpl.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body;
    expect(Object.fromEntries(body)).toEqual({ secret: "secret", response: "token", remoteip: "1.2.3.4" });
  });

  it("rejects a missing, oversized or refused token", async () => {
    const refuse = createTurnstileCheck("secret", answer({ success: false }));
    expect(await refuse("token")).toBe(false);
    expect(await refuse(null)).toBe(false);
    expect(await refuse("x".repeat(3000))).toBe(false);
  });

  it("lets the request through when Cloudflare is down (rate limits still apply)", async () => {
    expect(await createTurnstileCheck("secret", answer({}, false))("token")).toBe(true);
    const throwing = vi.fn(async () => Promise.reject(new Error("network")));
    expect(await createTurnstileCheck("secret", throwing)("token")).toBe(true);
  });
});
