import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@/core/logger";
import { createEmailModule, textToHtml, type EmailProvider } from "..";

const logger = createLogger({ write: () => {} });

describe("email module", () => {
  it("sends through the provider with the configured from address", async () => {
    const provider: EmailProvider = { send: vi.fn(async () => ({ id: "m1" })) };
    const email = createEmailModule({ provider, from: "noreply@example.com", logger });
    await email.asMailPort().send({ kind: "test", to: "a@example.com", subject: "Hi", text: "Hello" });
    expect(provider.send).toHaveBeenCalledWith({
      kind: "test",
      to: "a@example.com",
      subject: "Hi",
      text: "Hello",
      from: "noreply@example.com",
    });
  });

  it("logs only id and kind, never subject, body or recipient", async () => {
    const lines: string[] = [];
    const log = createLogger({ write: (l) => lines.push(l) });
    const ok = createEmailModule({ provider: { send: async () => ({ id: "m1" }) }, from: "f@example.com", logger: log });
    const bad = createEmailModule({
      provider: { send: async () => { throw new Error("boom"); } },
      from: "f@example.com",
      logger: log,
    });
    const message = { kind: "contact", to: "owner@example.com", subject: "Contact form: Zed Unique", text: "secret body" };

    await ok.send(message);
    await bad.send(message).catch(() => {});

    expect(lines.map((l) => JSON.parse(l).msg)).toEqual(["email.sent", "email.failed"]);
    expect(JSON.parse(lines[0]!)).toMatchObject({ id: "m1", kind: "contact" });
    expect(lines.join("\n")).not.toMatch(/Zed Unique|secret body|owner@example\.com/);
  });

  it("wraps provider failures in a safe AppError", async () => {
    const provider: EmailProvider = { send: async () => { throw new Error("401 invalid api key re_123"); } };
    const email = createEmailModule({ provider, from: "x@example.com", logger });
    await expect(email.send({ kind: "test", to: "a@example.com", subject: "s", text: "t" })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Email delivery failed",
    });
  });

  it("adds an escaped HTML version to plain-text emails; links stay clickable; explicit html wins", async () => {
    const provider: EmailProvider = { send: vi.fn(async () => ({ id: "m1" })) };
    const email = createEmailModule({ provider, from: "f@example.com", logger, html: { brand: "Acme <Co>", accent: "#0f766e" } });
    await email.send({ kind: "t", to: "a@example.com", subject: "s", text: "Xin chào <b>Lan</b>\n\nhttps://example.com/x?a=1&b=2" });
    const sent = vi.mocked(provider.send).mock.calls[0]![0];
    expect(sent.html).toContain("Xin chào &lt;b&gt;Lan&lt;/b&gt;");
    expect(sent.html).toContain("Acme &lt;Co&gt;");
    expect(sent.html).toContain(`<a href="https://example.com/x?a=1&amp;b=2"`);
    expect(sent.text).toContain("<b>Lan</b>"); // text part untouched

    await email.send({ kind: "t", to: "a@example.com", subject: "s", text: "t", html: "<p>own</p>" });
    expect(vi.mocked(provider.send).mock.calls[1]![0].html).toBe("<p>own</p>");
  });

  it("textToHtml rejects a non-hex accent (no CSS injection)", () => {
    expect(textToHtml("x", { brand: "B", accent: "red;background:url(x)" })).not.toContain("url(x)");
  });
});
