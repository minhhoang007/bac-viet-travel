import { describe, expect, it } from "vitest";
import { featureDefaults } from "./features.defaults";
import { features } from "./features";

describe("config overrides", () => {
  it("project features are based on starter defaults", () => {
    expect(Object.keys(features).sort()).toEqual(Object.keys(featureDefaults).sort());
  });

  it("starter defaults keep every module off", () => {
    const { profile, ...modules } = featureDefaults;
    expect(profile).toBe("site");
    expect(Object.values(modules).every((on) => on === false)).toBe(true);
  });
});
