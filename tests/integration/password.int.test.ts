import { and, count, eq, isNotNull, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authEvents, passkeys, sessions, verifications } from "@/core/auth/schema";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "./setup/db";
import { BASE_URL, signIn, testApp } from "./setup/app";
import { totp } from "./setup/totp";

const handle = testDb();
// Off by default (config/auth.defaults.ts): these tests turn it on.
const passwordOn = { passwordSignIn: true };
const t = testApp(handle.db, { overrides: passwordOn });
const { auth } = t.app;
const PASSWORD = "ha long sang som thang muoi";
const origin = () => new Headers({ origin: BASE_URL });

beforeEach(() => resetDb(handle.db));
afterAll(() => handle.close());

/** The token in a password email (link to the reset page). */
const tokenFrom = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;
/** Request headers carrying the cookies a service call set (as the browser would send them back). */
const withCookies = (setCookies: string[]) => new Headers({ cookie: setCookies.map((c) => c.split(";")[0]).join("; "), origin: BASE_URL });

/** An admin's invitation: account, editor level, emailed link, password set from it. */
async function invitedStaff(email: string) {
  const id = await auth.ensureAccount(email);
  await handle.db.update(users).set({ role: "editor" }).where(eq(users.id, id));
  await auth.sendPasswordSetup(email);
  expect(await auth.resetPassword(tokenFrom(t.sent.findLast((m) => m.to === email)!.text), PASSWORD)).toBe("done");
  return id;
}

/** A second factor already set up (a passkey row: password sign-ins then open a session, verified afterwards). */
const passkeyOn = (userId: string) =>
  handle.db.insert(passkeys).values({ userId, publicKey: "key", credentialID: crypto.randomUUID(), counter: 0, deviceType: "singleDevice", backedUp: false });

async function passwordSession(email: string) {
  const res = await auth.signInPassword({ email, password: PASSWORD, clientKey: "c" }, origin());
  expect(res.status).toBe("ok");
  return withCookies(res.setCookies);
}

const signIns = async (userId: string) => (await handle.db.select({ n: count() }).from(authEvents).where(and(eq(authEvents.userId, userId), eq(authEvents.kind, "sign_in"))))[0]!.n;

describe("staff invitation and password link", () => {
  it("creates the account, emails a link to the reset page, and the link sets the password once", async () => {
    const id = await auth.ensureAccount("Lan@Example.com");
    expect(await auth.ensureAccount("lan@example.com")).toBe(id);
    await handle.db.update(users).set({ role: "editor" }).where(eq(users.id, id));
    await auth.sendPasswordSetup("lan@example.com");
    const mail = t.sent.at(-1)!;
    expect(mail.to).toBe("lan@example.com");
    expect(mail.text).toContain(`${BASE_URL}/login/reset?token=`);
    const token = tokenFrom(mail.text);

    // Too short: refused before the link is spent.
    expect(await auth.resetPassword(token, "short")).toBe("too_short");
    expect(await auth.resetPassword(token, PASSWORD)).toBe("done");
    expect(await auth.resetPassword(token, PASSWORD)).toBe("invalid");

    const [u] = await handle.db.select().from(users).where(eq(users.id, id));
    expect(u!.emailVerified).toBe(true);
    expect((await auth.security.events(id)).map((e) => e.kind)).toContain("password_set");
    expect(t.sent.at(-1)!.subject).toContain("Bảo mật tài khoản đã thay đổi");
    expect(await auth.security.hasPassword(id)).toBe(true);
  });

  it("customers, disabled staff and unknown addresses get nothing (no link stored), with the same silent answer", async () => {
    await signIn(t, "guest@example.com");
    const [off] = await handle.db.update(users).set({ role: "editor", status: "disabled" }).where(eq(users.id, await auth.ensureAccount("off@example.com"))).returning();
    const before = t.sent.length;
    expect(await auth.sendPasswordSetup("guest@example.com")).toBe(false);
    await auth.requestPasswordReset({ email: "guest@example.com", clientKey: "c" });
    expect(await auth.sendPasswordSetup(off!.email)).toBe(false);
    await auth.requestPasswordReset({ email: "nobody@example.com", clientKey: "c" });
    expect(t.sent.length).toBe(before);
    expect(await handle.db.select().from(verifications).where(like(verifications.identifier, "reset-password:%"))).toEqual([]);
  });
});

describe("sign-in with a password", () => {
  it("right password: a session; wrong password, unknown address or disabled account: the same 'wrong'", async () => {
    const id = await invitedStaff("staff@example.com");
    await passkeyOn(id);
    const headers = await passwordSession("staff@example.com");
    expect((await auth.getSession(headers))?.user.email).toBe("staff@example.com");

    expect((await auth.signInPassword({ email: "staff@example.com", password: "not the password at all", clientKey: "c" }, origin())).status).toBe("wrong");
    expect((await auth.signInPassword({ email: "staff@example.com", password: "x".repeat(129), clientKey: "c" }, origin())).status).toBe("wrong");
    expect((await auth.signInPassword({ email: "ghost@example.com", password: PASSWORD, clientKey: "c" }, origin())).status).toBe("wrong");
    await handle.db.update(users).set({ status: "disabled" }).where(eq(users.id, id));
    expect((await auth.signInPassword({ email: "staff@example.com", password: PASSWORD, clientKey: "c" }, origin())).status).toBe("wrong");
  });

  it("a former employee (back to a customer account) cannot sign in with the old password", async () => {
    const id = await invitedStaff("left@example.com");
    await handle.db.update(users).set({ role: "user" }).where(eq(users.id, id));
    expect((await auth.signInPassword({ email: "left@example.com", password: PASSWORD, clientKey: "c" }, origin())).status).toBe("wrong");
  });

  it("no second factor yet: the right password opens no session; the first one is set up after an email link", async () => {
    const id = await invitedStaff("new@example.com");
    const attempt = (password: string) => auth.signInPassword({ email: "new@example.com", password, clientKey: "c" }, origin());
    expect(await attempt(PASSWORD)).toEqual({ status: "email_link", setCookies: [] });
    expect((await attempt("not the password at all")).status).toBe("wrong");
    expect(await handle.db.select().from(sessions).where(eq(sessions.userId, id))).toEqual([]);
    expect(await signIns(id)).toBe(0);

    // Signed in by email link: the authenticator app is set up; from then on the password asks for its code.
    const byEmail = await signIn(t, "new@example.com");
    const { totpURI } = await auth.security.startTotp(byEmail, PASSWORD);
    expect(await auth.security.verifyTotp(byEmail, totp(new URL(totpURI).searchParams.get("secret")!))).toBe(true);
    expect((await attempt(PASSWORD)).status).toBe("second_factor");
  });

  it("with the authenticator app on: no session until the code; the code finishes the sign-in (logged once)", async () => {
    const id = await invitedStaff("totp@example.com");
    const first = await signIn(t, "totp@example.com");
    const { totpURI } = await auth.security.startTotp(first, PASSWORD);
    const secret = new URL(totpURI).searchParams.get("secret")!;
    expect(await auth.security.verifyTotp(first, totp(secret))).toBe(true);

    const before = await signIns(id);
    const res = await auth.signInPassword({ email: "totp@example.com", password: PASSWORD, clientKey: "c" }, origin());
    expect(res.status).toBe("second_factor");
    const pending = withCookies(res.setCookies);
    expect(await auth.getSession(pending)).toBeNull();
    expect(auth.hasPendingSecondFactor(pending)).toBe(true);
    expect(await signIns(id)).toBe(before);

    const verified = async () => (await handle.db.select({ n: count() }).from(sessions).where(and(eq(sessions.userId, id), isNotNull(sessions.secondFactorAt))))[0]!.n;
    const sessionsBefore = await verified();
    expect(await auth.security.verifyTotp(pending, "000000")).toBe(false);
    expect(await auth.security.verifyTotp(pending, totp(secret, Date.now() + 30_000))).toBe(true);
    expect(await verified()).toBe(sessionsBefore + 1);
    expect(await signIns(id)).toBe(before + 1);
  });

  it("out of code attempts after a password: 'sign in again', not 'wrong code' forever", async () => {
    await invitedStaff("tries@example.com");
    const first = await signIn(t, "tries@example.com");
    const { totpURI } = await auth.security.startTotp(first, PASSWORD);
    const secret = new URL(totpURI).searchParams.get("secret")!;
    expect(await auth.security.verifyTotp(first, totp(secret))).toBe(true);

    const pending = withCookies((await auth.signInPassword({ email: "tries@example.com", password: PASSWORD, clientKey: "c" }, origin())).setCookies);
    const wrong = totp(secret) === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await auth.security.verifyTotp(pending, wrong)).toBe(false);
    await expect(auth.security.verifyTotp(pending, totp(secret, Date.now() + 30_000))).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
  });

  it("the demo site has no passwords (its mailbox is open to visitors)", () => {
    expect(testApp(handle.db, { env: { DEMO_MODE: "true" }, overrides: passwordOn }).app.auth.methods.password).toBe(false);
    expect(auth.methods.password).toBe(true);
    expect(testApp(handle.db).app.auth.methods.password).toBe(false); // the starter's default
  });

  it("the HTTP endpoints for passwords are closed: only this service signs in, resets or changes them", async () => {
    for (const path of ["/sign-in/email", "/sign-up/email", "/request-password-reset", "/reset-password", "/change-password", "/set-password"]) {
      const res = await auth.handler(new Request(`${BASE_URL}/api/auth${path}`, { method: "POST", headers: { origin: BASE_URL, "content-type": "application/json" }, body: "{}" }));
      expect(res.status, path).toBe(404);
    }
  });

  it("password attempts are limited per address", async () => {
    const limited = testApp(handle.db, { realRateLimits: true, overrides: passwordOn });
    const attempt = () => limited.app.auth.signInPassword({ email: "limit@example.com", password: "wrong wrong wrong", clientKey: crypto.randomUUID() }, origin());
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe("wrong");
    await expect(attempt()).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
  });
});

describe("password on the security page", () => {
  it("authenticator-app changes ask for the password once one is set", async () => {
    await invitedStaff("again@example.com");
    const headers = await signIn(t, "again@example.com");
    await expect(auth.security.startTotp(headers)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(auth.security.startTotp(headers, "a wrong password here")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await auth.security.startTotp(headers, PASSWORD)).totpURI).toMatch(/^otpauth:\/\//);
  });

  it("changing it needs a fresh second factor and the current password, then signs out the other devices", async () => {
    const id = await invitedStaff("change@example.com");
    const setup = await signIn(t, "change@example.com");
    const { totpURI } = await auth.security.startTotp(setup, PASSWORD);
    const secret = new URL(totpURI).searchParams.get("secret")!;
    expect(await auth.security.verifyTotp(setup, totp(secret))).toBe(true); // confirms the app (rotates that session)
    const first = await signIn(t, "change@example.com");
    expect(await auth.security.verifyTotp(first, totp(secret, Date.now() + 30_000))).toBe(true); // fresh second factor

    // A session without the second factor (e.g. a stolen cookie) cannot replace the password.
    const stale = await signIn(t, "change@example.com");
    await expect(auth.security.changePassword(stale, PASSWORD, "a brand new long password")).rejects.toMatchObject({ statusCode: 403 });

    expect(await auth.security.changePassword(first, "not my password at all", "a brand new long password")).toBe("wrong");
    expect(await auth.security.changePassword(first, PASSWORD, "short")).toBe("too_short");
    expect(await auth.security.changePassword(first, PASSWORD, "a brand new long password")).toBe("done");
    expect(await auth.getSession(stale)).toBeNull();
    expect(await auth.getSession(first)).not.toBeNull();
    expect((await auth.security.events(id)).map((e) => e.kind)).toContain("password_changed");
  });

  it("a customer cannot give their account a password", async () => {
    const headers = await signIn(t, "customer@example.com");
    await expect(auth.security.setPassword(headers, PASSWORD)).rejects.toMatchObject({ code: "PERMISSION_ERROR" });
  });

  it("links: an invitation lasts 24 hours, 'forgot password' 4; a new link replaces older ones, never an invitation by 'forgot password'", async () => {
    const id = await auth.ensureAccount("links@example.com");
    await handle.db.update(users).set({ role: "editor" }).where(eq(users.id, id));
    const links = async () =>
      (await handle.db.select().from(verifications).where(and(eq(verifications.value, id), like(verifications.identifier, "reset-password:%"))))
        .map((l) => [l.identifier.replace("reset-password:", ""), Math.round((l.expiresAt.getTime() - Date.now()) / 3_600_000)])
        .sort((a, b) => Number(b[1]) - Number(a[1]));
    const lastToken = () => tokenFrom(t.sent.at(-1)!.text);
    const forgot = async () => {
      await auth.requestPasswordReset({ email: "links@example.com", clientKey: "c" }); // anyone, from the login page
      expect(t.sent.at(-1)!.text).toContain("4 giờ");
      return lastToken();
    };

    expect(await auth.sendPasswordSetup("links@example.com")).toBe(true); // admin's invitation
    const invite = lastToken();
    expect(t.sent.at(-1)!.text).toContain("24 giờ");
    // Someone asks for "forgot password" (twice): the invitation stays, only the latest forgot link works.
    const first = await forgot();
    expect(await links()).toEqual([[invite, 24], [first, 4]]);
    const second = await forgot();
    expect(await links()).toEqual([[invite, 24], [second, 4]]);
    expect(await auth.resetPassword(first, PASSWORD)).toBe("invalid");

    // The admin sends again: only that link works.
    await auth.sendPasswordSetup("links@example.com");
    const again = lastToken();
    expect(await links()).toEqual([[again, 24]]);
    expect(await auth.resetPassword(again, PASSWORD)).toBe("done");
    expect(await links()).toEqual([]);
  });

  it("two links asked at once: only one works", async () => {
    const id = await auth.ensureAccount("race@example.com");
    await handle.db.update(users).set({ role: "editor" }).where(eq(users.id, id));
    await Promise.all([auth.sendPasswordSetup("race@example.com"), auth.sendPasswordSetup("race@example.com"), auth.sendPasswordSetup("race@example.com")]);
    expect(await handle.db.select().from(verifications).where(and(eq(verifications.value, id), like(verifications.identifier, "reset-password:%")))).toHaveLength(1);
  });

  it("'forgot password' can answer first and send after (same answer time for any address)", async () => {
    const id = await auth.ensureAccount("later@example.com");
    await handle.db.update(users).set({ role: "editor" }).where(eq(users.id, id));
    const deferred: (() => Promise<void>)[] = [];
    const before = t.sent.length;
    await auth.requestPasswordReset({ email: "later@example.com", clientKey: "c", defer: (work) => void deferred.push(work) });
    expect(t.sent.length).toBe(before);
    await deferred[0]!();
    expect(t.sent.at(-1)!.to).toBe("later@example.com");
  });

  it("setting a first password signs out the other devices and spends unused links", async () => {
    const other = await signIn(t, "devices@example.com");
    const headers = await signIn(t, "devices@example.com");
    const [u] = await handle.db.update(users).set({ role: "editor" }).where(eq(users.email, "devices@example.com")).returning();
    await auth.sendPasswordSetup("devices@example.com");
    expect(await auth.security.setPassword(headers, PASSWORD)).toBe("done");
    expect(await auth.getSession(other)).toBeNull();
    expect(await auth.getSession(headers)).not.toBeNull();
    expect(await handle.db.select().from(verifications).where(and(eq(verifications.value, u!.id), like(verifications.identifier, "reset-password:%")))).toEqual([]);
  });

  it("a staff member without a password sets a first one (once)", async () => {
    const headers = await signIn(t, "first@example.com");
    const [u] = await handle.db.update(users).set({ role: "editor" }).where(eq(users.email, "first@example.com")).returning();
    expect(await auth.security.hasPassword(u!.id)).toBe(false);
    expect(await auth.security.setPassword(headers, PASSWORD)).toBe("done");
    expect(await auth.security.setPassword(headers, PASSWORD)).toBe("invalid");
    expect(await auth.security.hasPassword(u!.id)).toBe(true);
  });
});
