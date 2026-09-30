import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import { createContactService } from ".";

const valid = { name: "An", email: "an@example.com", message: "Xin chào" };

function setup(mail: MailPort = { send: vi.fn(async () => {}) }, max = 5) {
  const service = createContactService({
    mail,
    rateLimiter: createMemoryRateLimiter({ max, windowMs: 60_000 }),
    to: "owner@example.com",
    logger: createLogger({ write: () => {} }),
  });
  return { service, mail };
}

describe("contact service", () => {
  it("sends a valid message to the owner with reply-to set", async () => {
    const { service, mail } = setup();
    expect(await service.submit(valid, "ip1")).toEqual({ status: "success" });
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com", replyTo: "an@example.com", subject: "Contact form: An" }),
    );
  });

  it("strips control characters from the subject (no header injection)", async () => {
    const { service, mail } = setup();
    await service.submit({ ...valid, name: "An\r\nBcc: victim@example.com" }, "ip1");
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ subject: "Contact form: An Bcc: victim@example.com" }));
  });

  it("returns field error codes for invalid input", async () => {
    const { service, mail } = setup();
    const result = await service.submit({ name: "", email: "nope", message: "x".repeat(5001) }, "ip1");
    expect(result).toEqual({
      status: "invalid",
      fieldErrors: { name: "required", email: "invalid_email", message: "too_long" },
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("silently drops honeypot submissions", async () => {
    const { service, mail } = setup();
    expect(await service.submit({ ...valid, website: "http://spam" }, "ip1")).toEqual({ status: "success" });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("rate limits per client key", async () => {
    const { service } = setup(undefined, 2);
    await service.submit(valid, "ip1");
    await service.submit(valid, "ip1");
    expect(await service.submit(valid, "ip1")).toEqual({ status: "rate_limited" });
    expect(await service.submit(valid, "ip2")).toEqual({ status: "success" });
  });

  it("reports a generic error when sending fails", async () => {
    const { service } = setup({ send: async () => { throw new Error("smtp down"); } });
    expect(await service.submit(valid, "ip1")).toEqual({ status: "error" });
  });
});
