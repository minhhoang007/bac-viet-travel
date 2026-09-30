import { AppError } from "@/core/errors";
import type { Features, ModuleManifest, ModuleName } from "./types";

type ModuleInput = Pick<ModuleManifest, "name" | "profiles"> & Partial<Omit<ModuleManifest, "name" | "profiles">>;

export function defineModule(input: ModuleInput): ModuleManifest {
  return { requires: [], uses: [], env: [], nav: [], ...input };
}

export function isModuleEnabled(features: Features, name: ModuleName): boolean {
  return features[name] === true;
}

/** Guard for every route, page and action of an optional module. Callers map MODULE_DISABLED to 404. */
export function assertModuleEnabled(features: Features, name: ModuleName): void {
  if (!isModuleEnabled(features, name)) {
    throw new AppError("MODULE_DISABLED", `Module "${name}" is disabled`);
  }
}

/** Startup validation: fails fast on missing requirements or wrong profile. Returns all problems at once. */
export function validateModules(features: Features, manifests: readonly ModuleManifest[]): string[] {
  const problems: string[] = [];
  for (const m of manifests) {
    if (!isModuleEnabled(features, m.name)) continue;
    if (!m.profiles.includes(features.profile)) {
      problems.push(`Module "${m.name}" is not available in profile "${features.profile}"`);
    }
    for (const dep of m.requires) {
      if (!isModuleEnabled(features, dep)) problems.push(`Module "${m.name}" requires "${dep}" to be enabled`);
    }
  }
  return problems;
}
