import { describe, expect, it } from "vitest";
import { niceMax } from "./money-chart";

describe("niceMax", () => {
  it("rounds the axis top up to 1, 2 or 5 × a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1_400_000)).toBe(2_000_000);
    expect(niceMax(2_000_000)).toBe(2_000_000);
    expect(niceMax(3_100_000)).toBe(5_000_000);
    expect(niceMax(7_900_000)).toBe(10_000_000);
  });
});
