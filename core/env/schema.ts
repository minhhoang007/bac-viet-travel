import { z } from "zod";

const bothOrNeither = (a: string | undefined, b: string | undefined) => !a === !b;
const isLocalhost = (url: string) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);

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
    // Optional Cloudflare Turnstile on the sign-in form (bot protection). Both or neither.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    // Billing providers (required per enabled provider, checked in bootstrap/env.ts).
    POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
    POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
    POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_PRODUCT_PRO_MONTHLY: z.string().min(1).optional(),
    POLAR_PRODUCT_PRO_YEARLY: z.string().min(1).optional(),
    VNPAY_TMN_CODE: z.string().min(1).optional(),
    VNPAY_HASH_SECRET: z.string().min(1).optional(),
    VNPAY_PAYMENT_URL: z.url().optional(),
    // Storage module (S3-compatible; Cloudflare R2 uses region "auto").
    STORAGE_REGION: z.string().min(1).default("auto"),
  })
  .refine((e) => bothOrNeither(e.UPSTASH_REDIS_REST_URL, e.UPSTASH_REDIS_REST_TOKEN), {
    message: "set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither",
    path: ["UPSTASH_REDIS_REST_URL"],
  })
  .refine((e) => bothOrNeither(e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET), {
    message: "set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
    path: ["GOOGLE_CLIENT_ID"],
  })
  .refine((e) => bothOrNeither(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY, e.TURNSTILE_SECRET_KEY), {
    message: "set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither",
    path: ["TURNSTILE_SECRET_KEY"],
  })
  .refine(
    (e) => e.NODE_ENV !== "production" || e.NEXT_PUBLIC_SITE_URL.startsWith("https://") || isLocalhost(e.NEXT_PUBLIC_SITE_URL),
    { message: "must use https in production (secure cookies depend on it)", path: ["NEXT_PUBLIC_SITE_URL"] },
  )
  .refine((e) => !(e.NODE_ENV === "production" && e.EMAIL_PROVIDER === "console"), {
    message: 'EMAIL_PROVIDER="console" is not allowed in production',
    path: ["EMAIL_PROVIDER"],
  });

/** Extra env required by the "app" profile. */
export const appProfileEnvKeys = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

export type BaseEnv = z.infer<typeof baseEnvSchema>;
