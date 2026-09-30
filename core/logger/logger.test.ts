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
