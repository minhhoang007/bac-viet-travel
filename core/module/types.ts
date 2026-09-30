export const MODULE_NAMES = [
  "email", "jobs", "entitlements", "billing", "usage",
  "storage", "analytics", "admin", "ai", "blog",
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];
export type Profile = "site" | "app";

export type Features = { profile: Profile } & Record<ModuleName, boolean>;

export interface NavItem {
  /** Plain text, or per-locale labels ({ vi, en }). */
  label: string | Record<string, string>;
  href: string;
}

export interface ModuleManifest {
  name: ModuleName;
  /** Profiles this module may run in. */
  profiles: readonly Profile[];
  /** Modules that must be enabled for this one to work. */
  requires: readonly ModuleName[];
  /** Modules used only when enabled (checked at runtime). */
  uses: readonly ModuleName[];
  /** Env vars required only when this module is enabled. */
  env: readonly string[];
  nav: readonly NavItem[];
}
