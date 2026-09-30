import { describe, expect, it } from "vitest";
import { securityHeaders } from "./headers";

const asMap = (isDev: boolean) => Object.fromEntries(securityHeaders({ isDev }).map((h) => [h.key, h.value]));

describe("security headers", () => {
  it("sets the baseline headers in production", () => {
    const h = asMap(false);
    expect(h["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
  });

  it("allows eval only in development", () => {
    expect(asMap(false)["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(asMap(true)["Content-Security-Policy"]).toContain("unsafe-eval");
  });
});
