import { buildContainer, type ContainerOverrides } from "@/bootstrap/container";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { featureDefaults } from "@/config/features.defaults";
import type { MailMessage, MailPort } from "@/core/ports/mail";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import type { Db } from "@/db/client";
import type { ModuleName } from "@/core/module";
import { TEST_DATABASE_URL } from "./db";
import { TEST_STORAGE } from "./storage";

export const BASE_URL = "http://localhost:3000";

/**
 * Container in profile "app" against the test DB, with a mail port that records messages.
 * Rate limits are relaxed unless `realRateLimits` is set (auth tests exercise the production limits).
 */
export function testApp(
  db: Db,
  options: {
    realRateLimits?: boolean;
    saas?: boolean;
    /** Extra modules to enable, e.g. { admin: true }. */
    modules?: Partial<Record<ModuleName, boolean>>;
    env?: Record<string, string>;
    overrides?: Omit<ContainerOverrides, "db" | "mail" | "authRateLimits">;
  } = {},
) {
  const sent: MailMessage[] = [];
  const mail: MailPort = { send: async (m) => void sent.push(m) };
  const saas = options.saas ? { jobs: true, entitlements: true, billing: true } : {};
  const features = { ...featureDefaults, profile: "app" as const, email: true, ...saas, ...options.modules };
  const env = validateEnv(
    {
      NODE_ENV: "test",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      LOG_LEVEL: "error",
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long!!",
      EMAIL_PROVIDER: "console",
      EMAIL_FROM: "noreply@example.com",
      CONTACT_TO_EMAIL: "owner@example.com",
      CRON_SECRET: "test-cron-secret",
      ANALYTICS_SECRET: "test-analytics-secret-at-least-32-chars",
      STORAGE_ENDPOINT: TEST_STORAGE.endpoint,
      STORAGE_BUCKET: TEST_STORAGE.bucket,
      STORAGE_ACCESS_KEY_ID: TEST_STORAGE.accessKeyId,
      STORAGE_SECRET_ACCESS_KEY: TEST_STORAGE.secretAccessKey,
      ...options.env,
    },
    features,
    moduleManifests,
  );
  const unlimited = createMemoryRateLimiter({ max: Number.MAX_SAFE_INTEGER, windowMs: 60_000 });
  const authRateLimits = options.realRateLimits ? undefined : { perClient: unlimited, perRecipient: unlimited };
  const container = buildContainer(features, env, { mail, db, authRateLimits, ...options.overrides });
  return { container, app: container.app!, sent };
}

/** Signs in through the real magic-link flow and returns request headers carrying the session cookie. */
export async function signIn(t: ReturnType<typeof testApp>, email: string): Promise<Headers> {
  await t.app.auth.signInMagicLink({ email: email, callbackURL: "/dashboard", errorCallbackURL: "/login", clientKey: crypto.randomUUID() }, new Headers({ origin: BASE_URL }));
  const message = t.sent.findLast((m) => m.to === email);
  const url = message?.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error("magic link not sent");

  const res = await t.app.auth.handler(new Request(url, { headers: { origin: BASE_URL } }));
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (!cookies) throw new Error(`no session cookie (status ${res.status})`);
  return new Headers({ cookie: cookies, origin: BASE_URL });
}
