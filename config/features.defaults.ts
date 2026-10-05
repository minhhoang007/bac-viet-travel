// Starter-owned. Projects override in config/features.ts (ADR-0004).
import type { Features } from "@/core/module";

export const featureDefaults = {
  profile: "site",
  email: false,
  jobs: false,
  entitlements: false,
  billing: false,
  usage: false,
  storage: false,
  media: false,
  content: false,
  analytics: false,
  admin: false,
  ai: false,
  blog: false,
} as const satisfies Features;
