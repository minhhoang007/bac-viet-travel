import { describe, expect, it } from "vitest";
import { featureDefaults } from "@/config/features.defaults";
import { assertModuleEnabled, defineModule, validateModules, type Features } from ".";

const billing = defineModule({ name: "billing", profiles: ["app"], requires: ["entitlements", "jobs"] });

describe("module system", () => {
  it("assertModuleEnabled throws MODULE_DISABLED when off", () => {
    expect(() => assertModuleEnabled(featureDefaults, "email")).toThrowError(
      expect.objectContaining({ code: "MODULE_DISABLED" }),
    );
    expect(() => assertModuleEnabled({ ...featureDefaults, email: true }, "email")).not.toThrow();
  });

  it("disabled modules are not validated", () => {
    expect(validateModules(featureDefaults, [billing])).toEqual([]);
  });

  it("reports wrong profile and missing requires", () => {
    const f: Features = { ...featureDefaults, profile: "site", billing: true, jobs: true };
    expect(validateModules(f, [billing])).toEqual([
      'Module "billing" is not available in profile "site"',
      'Module "billing" requires "entitlements" to be enabled',
    ]);
  });
});
