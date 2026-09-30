import { z } from "zod";

const bothOrNeither = (a: string | undefined, b: string | undefined) => !a === !b;

/** Env for every profile. Optional groups must be set together. */
export const baseEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    // Optional shared rate-limit store. Without it, an in-memory limiter is used.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // Email provider when the email module is on. "console" prints emails (development/test only).
    EMAIL_PROVIDER: z.enum(["resend", "console"]).default("resend"),
    EMAIL_API_KEY: z.string().min(1).optional(),
    // Optional Google sign-in (profile "app").
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .refine((e) => bothOrNeither(e.UPSTASH_REDIS_REST_URL, e.UPSTASH_REDIS_REST_TOKEN), {
    message: "set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither",
    path: ["UPSTASH_REDIS_REST_URL"],
  })
  .refine((e) => bothOrNeither(e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET), {
    message: "set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
    path: ["GOOGLE_CLIENT_ID"],
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.EMAIL_PROVIDER === "console"), {
    message: 'EMAIL_PROVIDER="console" is not allowed in production',
    path: ["EMAIL_PROVIDER"],
  });

/** Extra env required by the "app" profile. */
export const appProfileEnvKeys = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

export type BaseEnv = z.infer<typeof baseEnvSchema>;
