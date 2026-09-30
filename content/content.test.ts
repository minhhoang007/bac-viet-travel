import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appConfig } from "@/config/app";
import { getMarketingContent } from ".";

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.length > 0 ? [shape(value[0])] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

describe("content", () => {
  it("every locale has content with the same shape and no empty strings", () => {
    const reference = shape(getMarketingContent(appConfig.defaultLocale));
    for (const locale of appConfig.locales) {
      const c = getMarketingContent(locale);
      expect(shape(c)).toEqual(reference);
      expect(JSON.stringify(c)).not.toMatch(/""/);
    }
  });

  it("marketing and layout components contain no hard-coded visible text", () => {
    // A JSX text node starting with a letter, e.g. <h2>Features</h2>
    // (skips TS generics/arrows such as `=> Promise<T>`)
    const jsxText = /(?<!=)>\s*\p{L}[^<>{}();=]*</u;
    for (const dir of ["components/marketing", "components/layout"]) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
        const source = readFileSync(path.join(dir, file), "utf8");
        expect(source, `${dir}/${file}`).not.toMatch(jsxText);
      }
    }
  });
});
