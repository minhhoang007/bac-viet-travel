import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildContainer } from "@/bootstrap/container";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { featureDefaults } from "@/config/features.defaults";
import type { EmailProvider } from "@/modules/email";
import { BASE_URL } from "./setup/app";
import { resetDb, testDb, TEST_DATABASE_URL } from "./setup/db";

const { db, close } = testDb();
const features = { ...featureDefaults, profile: "app" as const, email: true, jobs: true };
const baseEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  LOG_LEVEL: "error",
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long!!",
  EMAIL_FROM: "noreply@example.com",
  CONTACT_TO_EMAIL: "owner@example.com",
  CRON_SECRET: "test-cron-secret",
};
const message = { kind: "booking_confirmed", to: "guest@example.com", subject: "Đơn BV-ABC123 đã xác nhận", text: "Xin chào…" };

beforeEach(() => resetDb(db));
afterAll(() => close());

describe("demo mode", () => {
  it("keeps emails in the demo mailbox instead of sending them; old ones are purged by the jobs tick", async () => {
    // No EMAIL_API_KEY: a demo site needs none.
    const env = validateEnv({ ...baseEnv, DEMO_MODE: "true" }, features, moduleManifests);
    const container = buildContainer(features, env, { db });
    await container.mail.send(message);
    expect(await container.demoMailbox!.list()).toMatchObject([{ kind: "booking_confirmed", to: "guest@example.com", subject: message.subject, text: message.text }]);

    await db.execute(sql`update demo_emails set created_at = now() - interval '8 days'`);
    await container.jobs!.tick();
    expect(await container.demoMailbox!.list()).toEqual([]);
  });

  it("is off by default: no mailbox, emails go to the provider", async () => {
    const sent: string[] = [];
    const provider: EmailProvider = { send: async (m) => (sent.push(m.to), { id: "x" }) };
    const env = validateEnv({ ...baseEnv, EMAIL_API_KEY: "re_test" }, features, moduleManifests);
    const container = buildContainer(features, env, { db, emailProvider: provider });
    await container.mail.send(message);
    expect(container.demoMailbox).toBeUndefined();
    expect(sent).toEqual(["guest@example.com"]);
  });
});
