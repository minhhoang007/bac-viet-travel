import { describe, expect, it, vi } from "vitest";
import { resendProvider } from "./email/resend";
import { upstashRateLimiter } from "./rate-limit/upstash";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("resend provider", () => {
  it("posts the message to the Resend API", async () => {
    const fetch = vi.fn(async () => json({ id: "re_1" }));
    const provider = resendProvider({ apiKey: "key", fetch });
    const result = await provider.send({ from: "f@x.com", to: "t@x.com", subject: "s", text: "t", replyTo: "r@x.com" });

    expect(result).toEqual({ id: "re_1" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(JSON.parse(init.body as string)).toEqual({ from: "f@x.com", to: ["t@x.com"], subject: "s", text: "t", reply_to: "r@x.com" });
  });

  it("throws on non-2xx without leaking the key", async () => {
    const provider = resendProvider({ apiKey: "secret-key", fetch: async () => json({}, 403) });
    await expect(provider.send({ from: "f", to: "t", subject: "s", text: "t" })).rejects.toThrow("Resend responded 403");
  });
});

describe("upstash rate limiter", () => {
  const rule = { max: 2, windowMs: 60_000 };

  it("allows up to max and blocks after", async () => {
    let count = 0;
    const fetch = vi.fn(async () => json([{ result: ++count }, { result: 1 }, { result: 60_000 }]));
    const limiter = upstashRateLimiter({ url: "https://r.upstash.io/", token: "t", fetch }, rule);

    expect((await limiter.limit("ip")).success).toBe(true);
    expect((await limiter.limit("ip")).success).toBe(true);
    expect(await limiter.limit("ip")).toMatchObject({ success: false, remaining: 0 });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://r.upstash.io/pipeline");
    expect(JSON.parse(init.body as string)[1]).toEqual(["PEXPIRE", "rl:ip", "60000", "NX"]);
  });
});
