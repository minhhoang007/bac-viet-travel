import { checkAuthConfig, type AuthMethodsConfig } from "@/core/auth/config-check";
import { appProfileEnvKeys, baseEnvSchema, type BaseEnv } from "@/core/env";
import { AppError } from "@/core/errors";
import { isModuleEnabled, validateModules, type Features, type ModuleManifest } from "@/core/module";
import { authConfig } from "@/config/auth";
import { billingConfig } from "@/config/billing";
import { features as projectFeatures } from "@/config/features";
import { moduleManifests } from "./modules";

type EnvSource = Record<string, string | undefined>;

export type Env = BaseEnv & { extra: Record<string, string> };

export interface ValidateOptions {
  auth?: AuthMethodsConfig;
  billingProviders?: readonly string[];
}

/** Required env keys beyond the base schema, for the given profile and enabled modules only. */
export function requiredEnvKeys(features: Features, manifests: readonly ModuleManifest[]): string[] {
  const keys = new Set<string>(features.profile === "app" ? appProfileEnvKeys : []);
  for (const m of manifests) {
    if (isModuleEnabled(features, m.name)) m.env.forEach((k) => keys.add(k));
  }
  return [...keys];
}

/** Pure validation — throws one error listing every problem. */
export function validateEnv(
  source: EnvSource,
  features: Features,
  manifests: readonly ModuleManifest[],
  options: ValidateOptions = {},
): Env {
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

  if (base.success) {
    if (features.email && base.data.EMAIL_PROVIDER === "resend" && !base.data.EMAIL_API_KEY) {
      problems.push('EMAIL_API_KEY: required when EMAIL_PROVIDER is "resend"');
    }
    if (options.auth) problems.push(...checkAuthConfig(features, options.auth, base.data));
    if (features.billing) {
      const needed: Record<string, readonly (keyof BaseEnv)[]> = {
        polar: ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET", "POLAR_PRODUCT_PRO_MONTHLY", "POLAR_PRODUCT_PRO_YEARLY"],
        vnpay: ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET"],
      };
      for (const provider of options.billingProviders ?? []) {
        for (const key of needed[provider] ?? []) {
          if (!base.data[key]) problems.push(`${key}: required when billing provider "${provider}" is enabled`);
        }
      }
      if (base.data.NODE_ENV === "production" && base.data.POLAR_SERVER === "sandbox" && options.billingProviders?.includes("polar")) {
        problems.push('POLAR_SERVER: "sandbox" in production — set POLAR_SERVER=production');
      }
    }
    if (extra.BETTER_AUTH_SECRET && extra.BETTER_AUTH_SECRET.length < 32) {
      problems.push("BETTER_AUTH_SECRET: must be at least 32 characters (openssl rand -base64 32)");
    }
  }

  if (problems.length > 0 || !base.success) {
    throw new AppError("INTERNAL_ERROR", `Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  }
  return { ...base.data, extra };
}

let cached: Env | undefined;

/** Lazily validated env for the running project. The only place that reads process.env. */
export function getEnv(): Env {
  return (cached ??= validateEnv(process.env, projectFeatures, moduleManifests, {
    auth: authConfig,
    billingProviders: billingConfig.providers,
  }));
}

export interface PublicEnv {
  NEXT_PUBLIC_SITE_URL: string;
}

/**
 * Public, non-secret values for statically rendered pages (metadata, robots, sitemap).
 * Does not require runtime secrets, so marketing pages can be prerendered at build time.
 */
export function getPublicEnv(): PublicEnv {
  const url = baseEnvSchema.shape.NEXT_PUBLIC_SITE_URL.safeParse(process.env.NEXT_PUBLIC_SITE_URL);
  if (!url.success) throw new AppError("INTERNAL_ERROR", "Invalid configuration:\n  - NEXT_PUBLIC_SITE_URL: invalid URL");
  return { NEXT_PUBLIC_SITE_URL: url.data };
}
