import { z } from "zod";

/** Env required by every profile. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** Extra env required by the "app" profile (DB + auth, V0.2). */
export const appProfileEnvKeys = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

export type BaseEnv = z.infer<typeof baseEnvSchema>;
