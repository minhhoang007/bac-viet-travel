import { describe, expect, it } from "vitest";
import { createLogger } from "@/core/logger";
import { sentryReporter } from "./sentry";

function fakeFetch(fail = false) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (fail) throw new Error("network down");
    return new Response("{}");
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("sentryReporter", () => {
  it("posts one envelope per error to the DSN's project, authenticated with the public key", async () => {
    const fake = fakeFetch();
    const report = sentryReporter({ dsn: "https://abc123@o1.ingest.sentry.io/4507", environment: "production", release: "1a2b3c4", fetch: fake.fetch });
    await report({ time: "2026-10-27T00:00:00.000Z", level: "error", msg: "job.dead", name: "email.send" });

    expect(fake.calls[0]!.url).toBe("https://o1.ingest.sentry.io/api/4507/envelope/");
    expect((fake.calls[0]!.init.headers as Record<string, string>)["X-Sentry-Auth"]).toContain("sentry_key=abc123");
    const [header, item, event] = String(fake.calls[0]!.init.body).split("\n").map((l) => JSON.parse(l));
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({ event_id: header.event_id, level: "error", message: { formatted: "job.dead" }, environment: "production", release: "1a2b3c4", extra: { name: "email.send" } });
  });

  it("through the logger: only errors are sent, already redacted, and a failing Sentry never throws", async () => {
    const fake = fakeFetch(true);
    const sent: Promise<void>[] = [];
    const report = sentryReporter({ dsn: "https://k@sentry.example.com/1", fetch: fake.fetch });
    const logger = createLogger({ write: () => {}, onError: (e) => void sent.push(report(e)) });

    logger.info("fine");
    logger.warn("hmm");
    logger.error("billing.webhook_dead", { email: "a@b.vn", token: "t" });
    await Promise.all(sent);

    expect(fake.calls).toHaveLength(1);
    const body = String(fake.calls[0]!.init.body);
    expect(body).not.toContain("a@b.vn");
    expect(body).toContain("[REDACTED]");
  });
});
