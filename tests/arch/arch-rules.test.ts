import { createRequire } from "node:module";
import path from "node:path";
import { cruise } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { forbidden } = require("../../.dependency-cruiser.cjs") as { forbidden: unknown[] };
const fixtures = path.resolve(import.meta.dirname, "../arch-fixtures");

async function violations() {
  const result = await cruise(
    ["core", "app", "product", "modules", "providers"],
    { baseDir: fixtures, validate: true, ruleSet: { forbidden } } as never,
  );
  const output = result.output as { summary: { violations: { rule: { name: string }; from: string }[] } };
  return output.summary.violations.map((v) => ({ rule: v.rule.name, from: v.from }));
}

describe("architecture rules catch their fixtures", () => {
  it("reports exactly the expected violations", async () => {
    const found = await violations();
    const byRule = (name: string) => found.filter((v) => v.rule === name).map((v) => v.from).sort();

    expect(byRule("core-no-upward")).toEqual(["core/imports-module.ts"]);
    expect(byRule("providers-only-from-bootstrap")).toEqual(["app/imports-provider.ts"]);
    // One report per cycle; which end is "from" is not guaranteed.
    expect(byRule("no-circular")).toHaveLength(1);
    expect(byRule("no-circular")[0]).toMatch(/^product\/cycle-[ab]\.ts$/);
  });

  it("has a fixture for every configured rule", async () => {
    const rulesWithFixtures = new Set((await violations()).map((v) => v.rule));
    for (const rule of forbidden as { name: string }[]) expect(rulesWithFixtures).toContain(rule.name);
  });
});
