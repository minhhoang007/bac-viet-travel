import { describe, expect, it } from "vitest";
import { utcToZoned, zonedToUtc } from "./time-zone";

describe("time zone helpers", () => {
  it("reads a datetime-local value in the given zone", () => {
    expect(zonedToUtc("2026-10-06T08:00", "Asia/Ho_Chi_Minh")?.toISOString()).toBe("2026-10-06T01:00:00.000Z");
    expect(zonedToUtc("2026-07-01T12:00", "Europe/Paris")?.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedToUtc("2026-10-06", "Asia/Ho_Chi_Minh")).toBeNull();
  });
  it("round-trips", () => {
    expect(utcToZoned(new Date("2026-10-06T01:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("2026-10-06T08:00");
  });
});
