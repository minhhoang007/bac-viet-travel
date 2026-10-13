import { describe, expect, it } from "vitest";
import { createLogger, requestLogger } from ".";

function capture(level?: "debug" | "info") {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({ level, write: (l) => lines.push(JSON.parse(l)) });
  return { logger, lines };
}

describe("logger", () => {
  it("writes structured JSON with level and message", () => {
    const { logger, lines } = capture();
    logger.info("hello", { a: 1 });
    expect(lines[0]).toMatchObject({ level: "info", msg: "hello", a: 1 });
  });

  it("redacts sensitive keys at any depth", () => {
    const { logger, lines } = capture();
    logger.info("x", { password: "p", nested: { apiKey: "k", headers: { authorization: "Bearer t" } }, ok: "v" });
    expect(lines[0]).toMatchObject({
      password: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", headers: { authorization: "[REDACTED]" } },
      ok: "v",
    });
  });

  it("redacts personal data keys (email, phone)", () => {
    const { logger, lines } = capture();
    logger.info("x", { email: "an@example.com", userEmail: "an@example.com", phone: "0900000000", id: "u1" });
    expect(lines[0]).toMatchObject({ email: "[REDACTED]", userEmail: "[REDACTED]", phone: "[REDACTED]", id: "u1" });
  });

  it("logs database errors by code only: their messages carry query parameters", () => {
    const { logger, lines } = capture();
    const pg = Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), {
      name: "PostgresError",
      code: "23505",
      constraint_name: "users_email_unique",
      detail: "Key (email)=(an@example.com) already exists.",
    });
    const query = Object.assign(new Error("Failed query: insert into users (email) values ($1)\nparams: an@example.com"), {
      query: "insert into users (email) values ($1)",
      params: ["an@example.com"],
      cause: pg,
    });
    logger.error("x", { error: query, wrapped: new Error("outer", { cause: query }) });
    expect(JSON.stringify(lines[0])).not.toContain("an@example.com");
    expect(lines[0]).toMatchObject({
      error: { message: "Database error 23505 users_email_unique" },
      wrapped: { message: "Database error 23505 users_email_unique" },
    });
  });

  it("keeps the message of ordinary errors", () => {
    const { logger, lines } = capture();
    logger.error("x", { error: new Error("Resend responded 500") });
    expect(lines[0]).toMatchObject({ error: { name: "Error", message: "Resend responded 500" } });
  });

  it("filters below the configured level", () => {
    const { logger, lines } = capture("info");
    logger.debug("hidden");
    expect(lines).toHaveLength(0);
  });

  it("binds a request id", () => {
    const { logger, lines } = capture();
    requestLogger(logger, "req-1").info("x");
    requestLogger(logger).info("y");
    expect(lines[0]?.requestId).toBe("req-1");
    expect(typeof lines[1]?.requestId).toBe("string");
  });
});
