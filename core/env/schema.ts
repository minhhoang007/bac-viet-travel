import { z } from "zod";

/** Env required by every profile. */
export const baseEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    // Optional shared rate-limit store. Without it, an in-memory limiter is used.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  })
  .refine((env) => !env.UPSTASH_REDIS_REST_URL === !env.UPSTASH_REDIS_REST_TOKEN, {
    message: "set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither",
    path: ["UPSTASH_REDIS_REST_URL"],
  });

/** Extra env required by the "app" profile (DB + auth, V0.2). */
export const appProfileEnvKeys = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

export type BaseEnv = z.infer<typeof baseEnvSchema>;
