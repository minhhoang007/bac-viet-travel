import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@/core/logger";
import { createEmailModule, type EmailProvider } from "..";

const logger = createLogger({ write: () => {} });

describe("email module", () => {
  it("sends through the provider with the configured from address", async () => {
    const provider: EmailProvider = { send: vi.fn(async () => ({ id: "m1" })) };
    const email = createEmailModule({ provider, from: "noreply@example.com", logger });
    await email.asMailPort().send({ to: "a@example.com", subject: "Hi", text: "Hello" });
    expect(provider.send).toHaveBeenCalledWith({ to: "a@example.com", subject: "Hi", text: "Hello", from: "noreply@example.com" });
  });

  it("wraps provider failures in a safe AppError", async () => {
    const provider: EmailProvider = { send: async () => { throw new Error("401 invalid api key re_123"); } };
    const email = createEmailModule({ provider, from: "x@example.com", logger });
    await expect(email.send({ to: "a@example.com", subject: "s", text: "t" })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Email delivery failed",
    });
  });
});
