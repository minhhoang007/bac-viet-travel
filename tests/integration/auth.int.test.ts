import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "./setup/db";
import { BASE_URL, signIn, testApp } from "./setup/app";

const handle = testDb();
const t = testApp(handle.db, { realRateLimits: true });

beforeEach(() => resetDb(handle.db));
afterAll(() => handle.close());

describe("auth (magic link, real DB)", () => {
  it("anonymous requests have no user", async () => {
    expect(await t.app.auth.getUser(new Headers())).toBeNull();
    await expect(t.app.auth.requireUser(new Headers())).rejects.toMatchObject({ code: "AUTH_ERROR" });
  });

  it("magic link signs up a new user with role user and a UUIDv7 id", async () => {
    const headers = await signIn(t, "an@example.com");
    const user = await t.app.auth.requireUser(headers);
    expect(user).toMatchObject({ email: "an@example.com", role: "user" });
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });

  it("magic link email goes to the requested address and targets this site", async () => {
    await t.app.auth.signInMagicLink({ email: "binh@example.com", callbackURL: "/dashboard", errorCallbackURL: "/login", clientKey: crypto.randomUUID() }, new Headers({ origin: BASE_URL }));
    const message = t.sent.at(-1)!;
    expect(message.to).toBe("binh@example.com");
    expect(message.text).toContain(`${BASE_URL}/api/auth/magic-link/verify?token=`);
  });

  it("a magic link token works only once", async () => {
    await t.app.auth.signInMagicLink({ email: "once@example.com", callbackURL: "/dashboard", errorCallbackURL: "/login", clientKey: crypto.randomUUID() }, new Headers({ origin: BASE_URL }));
    const url = t.sent.at(-1)!.text.match(/https?:\/\/\S+/)![0];
    await t.app.auth.handler(new Request(url));
    const second = await t.app.auth.handler(new Request(url));
    expect(second.headers.getSetCookie().some((c) => c.includes("session_token=") && !c.includes("Max-Age=0"))).toBe(false);
    // The user lands on the login page with a message instead of a blank redirect.
    expect(second.headers.get("location")).toMatch(/\/login\?error=/);
  });

  it("magic links are rate limited per recipient even from many clients (no email spam)", async () => {
    const send = (clientKey: string) =>
      t.app.auth.signInMagicLink(
        { email: "victim@example.com", callbackURL: "/dashboard", errorCallbackURL: "/login", clientKey },
        new Headers({ origin: BASE_URL }),
      );
    for (let i = 0; i < 3; i++) await send(`client-${i}`);
    const sentBefore = t.sent.filter((m) => m.to === "victim@example.com").length;

    await expect(send("client-99")).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
    expect(t.sent.filter((m) => m.to === "victim@example.com")).toHaveLength(sentBefore);
    expect(sentBefore).toBe(3);
  });

  it("magic links are rate limited per client across recipients", async () => {
    const send = (i: number) =>
      t.app.auth.signInMagicLink(
        { email: `spray-${i}@example.com`, callbackURL: "/dashboard", errorCallbackURL: "/login", clientKey: "198.51.100.7" },
        new Headers({ origin: BASE_URL }),
      );
    for (let i = 0; i < 5; i++) await send(i);
    await expect(send(5)).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
    expect(t.sent.some((m) => m.to === "spray-5@example.com")).toBe(false);
  });

  it("session cookie is HttpOnly and SameSite=Lax", async () => {
    await t.app.auth.signInMagicLink({ email: "cookie@example.com", callbackURL: "/dashboard", errorCallbackURL: "/login", clientKey: crypto.randomUUID() }, new Headers({ origin: BASE_URL }));
    const url = t.sent.at(-1)!.text.match(/https?:\/\/\S+/)![0];
    const res = await t.app.auth.handler(new Request(url));
    const session = res.headers.getSetCookie().find((c) => c.includes("session_token="))!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
  });

  it("sign out ends the session", async () => {
    const headers = await signIn(t, "out@example.com");
    await t.app.auth.signOut(headers);
    expect(await t.app.auth.getUser(headers)).toBeNull();
  });

  it("requireRole: user is refused admin, admin is allowed", async () => {
    const headers = await signIn(t, "role@example.com");
    await expect(t.app.auth.requireRole(headers, "admin")).rejects.toMatchObject({ code: "PERMISSION_ERROR" });

    await handle.db.update(users).set({ role: "admin" }).where(eq(users.email, "role@example.com"));
    await expect(t.app.auth.requireRole(headers, "admin")).resolves.toMatchObject({ role: "admin" });
  });

  it("requireRole is hierarchical: editor pages admit editors and admins, admin pages refuse editors", async () => {
    const headers = await signIn(t, "editor@example.com");
    await expect(t.app.auth.requireRole(headers, "editor")).rejects.toMatchObject({ code: "PERMISSION_ERROR" });
    await handle.db.update(users).set({ role: "editor" }).where(eq(users.email, "editor@example.com"));
    await expect(t.app.auth.requireRole(headers, "editor")).resolves.toMatchObject({ role: "editor" });
    await expect(t.app.auth.requireRole(headers, "admin")).rejects.toMatchObject({ code: "PERMISSION_ERROR" });
    await handle.db.update(users).set({ role: "admin" }).where(eq(users.email, "editor@example.com"));
    await expect(t.app.auth.requireRole(headers, "editor")).resolves.toMatchObject({ role: "admin" });
  });

  it("disabled users are treated as signed out", async () => {
    const headers = await signIn(t, "off@example.com");
    await handle.db.update(users).set({ status: "disabled" }).where(eq(users.email, "off@example.com"));
    expect(await t.app.auth.getUser(headers)).toBeNull();
  });
});
