import { buildContainer } from "@/bootstrap/container";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { featureDefaults } from "@/config/features.defaults";
import type { MailMessage, MailPort } from "@/core/ports/mail";
import type { Db } from "@/db/client";
import { TEST_DATABASE_URL } from "./db";

export const BASE_URL = "http://localhost:3000";

/** Container in profile "app" against the test DB, with a mail port that records messages. */
export function testApp(db: Db) {
  const sent: MailMessage[] = [];
  const mail: MailPort = { send: async (m) => void sent.push(m) };
  const features = { ...featureDefaults, profile: "app" as const, email: true };
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
    },
    features,
    moduleManifests,
  );
  const container = buildContainer(features, env, { mail, db });
  return { container, app: container.app!, sent };
}

/** Signs in through the real magic-link flow and returns request headers carrying the session cookie. */
export async function signIn(t: ReturnType<typeof testApp>, email: string): Promise<Headers> {
  await t.app.auth.signInMagicLink(email, "/dashboard", new Headers({ origin: BASE_URL }));
  const message = t.sent.findLast((m) => m.to === email);
  const url = message?.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error("magic link not sent");

  const res = await t.app.auth.handler(new Request(url, { headers: { origin: BASE_URL } }));
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (!cookies) throw new Error(`no session cookie (status ${res.status})`);
  return new Headers({ cookie: cookies, origin: BASE_URL });
}
