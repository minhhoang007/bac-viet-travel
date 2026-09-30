import { appProfileEnvKeys, baseEnvSchema, type BaseEnv } from "@/core/env";
import { AppError } from "@/core/errors";
import { isModuleEnabled, validateModules, type Features, type ModuleManifest } from "@/core/module";
import { features as projectFeatures } from "@/config/features";
import { moduleManifests } from "./modules";

type EnvSource = Record<string, string | undefined>;

export type Env = BaseEnv & { extra: Record<string, string> };

/** Required env keys beyond the base schema, for the given profile and enabled modules only. */
export function requiredEnvKeys(features: Features, manifests: readonly ModuleManifest[]): string[] {
  const keys = new Set<string>(features.profile === "app" ? appProfileEnvKeys : []);
  for (const m of manifests) {
    if (isModuleEnabled(features, m.name)) m.env.forEach((k) => keys.add(k));
  }
  return [...keys];
}

/** Pure validation — throws one error listing every problem. */
export function validateEnv(source: EnvSource, features: Features, manifests: readonly ModuleManifest[]): Env {
  const problems = validateModules(features, manifests);

  const base = baseEnvSchema.safeParse(source);
  if (!base.success) {
    for (const issue of base.error.issues) problems.push(`${issue.path.join(".")}: ${issue.message}`);
  }

  const extra: Record<string, string> = {};
  for (const key of requiredEnvKeys(features, manifests)) {
    const value = source[key];
    if (!value) problems.push(`${key}: required (profile "${features.profile}" / enabled modules)`);
    else extra[key] = value;
  }

  if (problems.length > 0 || !base.success) {
    throw new AppError("INTERNAL_ERROR", `Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  }
  return { ...base.data, extra };
}

let cached: Env | undefined;

/** Lazily validated env for the running project. The only place that reads process.env. */
export function getEnv(): Env {
  return (cached ??= validateEnv(process.env, projectFeatures, moduleManifests));
}
