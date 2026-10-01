import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// G10: files read from disk at request time are only deployed if traced into the serverless functions.
describe("next.config", () => {
  it("ships content/ with every serverless function", () => {
    expect(nextConfig.outputFileTracingIncludes?.["/**/*"]).toContain("./content/**/*");
  });
});
