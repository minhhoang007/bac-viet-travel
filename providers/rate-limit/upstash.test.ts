import { describe, expect, it } from "vitest";
import { upstashPing } from "./upstash";

const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("upstashPing", () => {
  it("true only when Upstash answers PONG", async () => {
    expect(await upstashPing({ url: "https://x.upstash.io/", token: "t", fetch: answer(200, { result: "PONG" }) })).toBe(true);
    expect(await upstashPing({ url: "https://x.upstash.io", token: "t", fetch: answer(401, { error: "Unauthorized" }) })).toBe(false);
    expect(await upstashPing({ url: "https://x.upstash.io", token: "t", fetch: answer(200, { error: "NOPERM" }) })).toBe(false);
  });

  it("false, never a throw, when nothing answers in time", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await upstashPing({ url: "redis://wrong", token: "t", fetch: down })).toBe(false);
    const slow = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    expect(await upstashPing({ url: "https://x.upstash.io", token: "t", fetch: slow, timeoutMs: 20 })).toBe(false);
  });
});
