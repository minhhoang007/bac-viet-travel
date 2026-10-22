import { describe, expect, it } from "vitest";
import { blogConfig } from "@/config/blog";
import { contentPostProblems } from "..";

describe("the project's blog config", () => {
  it("quick facts: keys a post can store (letters only, at most 12, no repeats)", () => {
    const keys = blogConfig.facts.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    const post = { locale: "vi", title: "T", description: "D", date: "2026-01-01", tags: [], body: "B", facts: Object.fromEntries(keys.map((k) => [k, "x"])) };
    expect(contentPostProblems(post).filter((p) => p.startsWith("facts"))).toEqual([]);
  });
});
