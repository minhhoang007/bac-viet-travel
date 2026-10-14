import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildContainer } from "@/bootstrap/container";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { featureDefaults } from "@/config/features.defaults";
import { users } from "@/core/users/schema";
import type { EmailProvider } from "@/modules/email";
import { BASE_URL, signIn, testApp } from "./setup/app";
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

  describe("demo sign-in", () => {
    const DEMO = "demo-manager@example.com";
    const demoApp = (env: Record<string, string> = { DEMO_MODE: "true" }) => testApp(db, { modules: { admin: true }, env, overrides: { demoAccounts: [DEMO] } });
    const h = () => new Headers({ origin: BASE_URL });
    async function user(t: ReturnType<typeof testApp>, email: string, role: "user" | "editor" | "admin") {
      await signIn(t, email); // creates the account through the real magic-link flow
      await db.update(users).set({ role }).where(eq(users.email, email));
    }
    const follow = async (t: ReturnType<typeof testApp>, link: string) => {
      const res = await t.app.auth.handler(new Request(link, { headers: { origin: BASE_URL } }));
      return new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), origin: BASE_URL });
    };

    it("signs a demo editor in with one link; that account skips the second factor, other staff do not", async () => {
      const t = demoApp();
      await user(t, DEMO, "editor");
      await user(t, "real-editor@example.com", "editor");
      const link = await t.app.auth.demoSignIn(DEMO, "/vi/admin", h());
      expect(link).toMatch(/^http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?/);
      const current = await t.app.auth.getSession(await follow(t, link!));
      expect(current?.user.email).toBe(DEMO);
      expect(await t.app.auth.staffGate(current!)).toBe("ok");
      expect(t.app.auth.isFresh(current!)).toBe(true);
      // A real editor on the same demo site still needs a second factor.
      const other = await t.app.auth.getSession(await signIn(t, "real-editor@example.com"));
      expect(await t.app.auth.staffGate(other!)).toBe("enroll");
      expect(t.app.auth.isFresh(other!)).toBe(false);
      // The link is used once.
      expect((await t.app.auth.handler(new Request(link!, { headers: { origin: BASE_URL } }))).headers.getSetCookie()).toEqual([]);
    });

    it("refuses any other email, a missing or disabled account, an admin, and everything when DEMO_MODE is off", async () => {
      const t = demoApp();
      expect(await t.app.auth.demoSignIn(DEMO, "/vi/admin", h())).toBeNull(); // no account yet
      await user(t, "real-editor@example.com", "editor");
      expect(await t.app.auth.demoSignIn("real-editor@example.com", "/vi/admin", h())).toBeNull(); // not a demo account
      await user(t, DEMO, "admin");
      expect(await t.app.auth.demoSignIn(DEMO, "/vi/admin", h())).toBeNull(); // never an admin
      await db.update(users).set({ role: "editor", status: "disabled" }).where(eq(users.email, DEMO));
      expect(await t.app.auth.demoSignIn(DEMO, "/vi/admin", h())).toBeNull();
      await db.update(users).set({ status: "active" }).where(eq(users.email, DEMO));
      expect(await t.app.auth.demoSignIn(DEMO, "/vi/admin", h())).not.toBeNull();

      const off = demoApp({});
      expect(await off.app.auth.demoSignIn(DEMO, "/vi/admin", h())).toBeNull();
      const session = await off.app.auth.getSession(await signIn(off, DEMO));
      expect(await off.app.auth.staffGate(session!)).toBe("enroll");
    });
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
