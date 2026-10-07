import { createHmac } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authEvents, sessions } from "@/core/auth/schema";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "./setup/db";
import { BASE_URL, loginCodeFrom, magicLinkFrom, signIn, testApp } from "./setup/app";

const handle = testDb();
const t = testApp(handle.db);
const { auth } = t.app;

beforeEach(() => resetDb(handle.db));
afterAll(() => handle.close());

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits), as authenticator apps compute it.
function totp(base32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0xf;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function makeStaff(email: string, role: "editor" | "admin" = "editor") {
  const headers = await signIn(t, email);
  await handle.db.update(users).set({ role }).where(eq(users.email, email));
  return headers;
}

/** Sets up the authenticator app (confirming it rotates the session), then signs in again: a session without 2FA. */
async function staffWithTotp(email: string) {
  const first = await makeStaff(email);
  const { totpURI, backupCodes } = await auth.security.startTotp(first);
  const secret = new URL(totpURI).searchParams.get("secret")!;
  expect(await auth.security.verifyTotp(first, totp(secret))).toBe(true);
  const headers = await signIn(t, email);
  return { headers, secret, backupCodes };
}

describe("sign-in email: confirmation link and 6-digit code", () => {
  it("the code opens the same one-time link, once", async () => {
    await auth.signInMagicLink({ email: "code@example.com", callbackURL: "/admin", errorCallbackURL: "/login", clientKey: "c1" }, new Headers({ origin: BASE_URL }));
    const text = t.sent.at(-1)!.text;
    const code = loginCodeFrom(text)!;
    expect(code).toMatch(/^\d{6}$/);
    expect(t.sent.at(-1)!.subject).toContain(code);

    const link = await auth.redeemLoginCode({ email: "code@example.com", code, clientKey: "c1" });
    expect(link).toBe(magicLinkFrom(text));
    expect(await auth.redeemLoginCode({ email: "code@example.com", code, clientKey: "c1" })).toBeNull();
  });

  it("five wrong codes drop it (no brute force); another address cannot use it", async () => {
    await auth.signInMagicLink({ email: "guess@example.com", callbackURL: "/admin", errorCallbackURL: "/login", clientKey: "c2" }, new Headers({ origin: BASE_URL }));
    const code = loginCodeFrom(t.sent.at(-1)!.text)!;
    expect(await auth.redeemLoginCode({ email: "other@example.com", code, clientKey: "c2" })).toBeNull();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await auth.redeemLoginCode({ email: "guess@example.com", code: wrong, clientKey: "c2" })).toBeNull();
    expect(await auth.redeemLoginCode({ email: "guess@example.com", code, clientKey: "c2" })).toBeNull();
  });
});

describe("staff sessions and second factor", () => {
  it("staff sessions end after 12 hours; customer sessions do not", async () => {
    const staff = await makeStaff("shift@example.com");
    const customer = await signIn(t, "guest@example.com");
    await handle.db.update(sessions).set({ createdAt: sql`now() - interval '13 hours'` });
    expect(await auth.getUser(customer)).toMatchObject({ email: "guest@example.com" });
    expect(await auth.getUser(staff)).toBeNull();
    const [user] = await handle.db.select({ id: users.id }).from(users).where(eq(users.email, "shift@example.com"));
    expect(await handle.db.select().from(sessions).where(eq(sessions.userId, user!.id))).toHaveLength(0);
  });

  it("gate: enroll first, then verify each session with the authenticator app", async () => {
    const first = await makeStaff("lan@example.com");
    expect(await auth.staffGate((await auth.getSession(first))!)).toBe("enroll");
    // Customers never meet the gate.
    const guest = await signIn(t, "guest2@example.com");
    expect(await auth.staffGate((await auth.getSession(guest))!)).toBe("ok");

    const { headers, secret } = await staffWithTotp("lan@example.com");
    // Confirming the app counted as the second factor for the (rotated) session.
    const [user] = await handle.db.select({ id: users.id }).from(users).where(eq(users.email, "lan@example.com"));
    expect(await handle.db.select().from(sessions).where(and(eq(sessions.userId, user!.id), isNotNull(sessions.secondFactorAt)))).toHaveLength(1);

    const fresh = (await auth.getSession(headers))!;
    expect(await auth.staffGate(fresh)).toBe("verify");
    expect(await auth.security.verifyTotp(headers, "000000" === totp(secret) ? "111111" : "000000")).toBe(false);
    expect(await auth.security.verifyTotp(headers, totp(secret))).toBe(true);
    const passed = (await auth.getSession(headers))!;
    expect(await auth.staffGate(passed)).toBe("ok");
    expect(auth.isFresh(passed)).toBe(true);
  });

  it("changing second factors needs a fresh second factor once one exists", async () => {
    const { headers, secret } = await staffWithTotp("minh@example.com");
    await expect(auth.security.newBackupCodes(headers)).rejects.toMatchObject({ statusCode: 403 });
    await expect(auth.security.disableTotp(headers)).rejects.toMatchObject({ statusCode: 403 });
    expect(await auth.security.verifyTotp(headers, totp(secret))).toBe(true);
    expect(await auth.security.newBackupCodes(headers)).toHaveLength(10);
  });

  it("second-factor codes are limited per account: five tries per 15 minutes, then even the right code waits", async () => {
    const limited = testApp(handle.db, { realRateLimits: true });
    const first = await signIn(limited, "brute@example.com");
    await handle.db.update(users).set({ role: "editor" }).where(eq(users.email, "brute@example.com"));
    const { totpURI } = await limited.app.auth.security.startTotp(first);
    const secret = new URL(totpURI).searchParams.get("secret")!;
    expect(await limited.app.auth.security.verifyTotp(first, totp(secret))).toBe(true); // 1 of 5
    const headers = await signIn(limited, "brute@example.com");
    const wrong = totp(secret) === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect(await limited.app.auth.security.verifyTotp(headers, wrong)).toBe(false);
    await expect(limited.app.auth.security.verifyTotp(headers, totp(secret))).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
    await expect(limited.app.auth.security.verifyBackupCode(headers, "anything")).rejects.toMatchObject({ code: "RATE_LIMIT_ERROR" });
  });

  it("a backup code passes the second factor once", async () => {
    const { headers, backupCodes } = await staffWithTotp("backup@example.com");
    expect(await auth.security.verifyBackupCode(headers, backupCodes[0]!)).toBe(true);
    expect(await auth.staffGate((await auth.getSession(headers))!)).toBe("ok");
    const again = await signIn(t, "backup@example.com");
    expect(await auth.security.verifyBackupCode(again, backupCodes[0]!)).toBe(false);
  });

  it("devices: list this session and others, sign out the others", async () => {
    const a = await makeStaff("devices@example.com");
    const b = await signIn(t, "devices@example.com");
    const list = await auth.security.devices(a);
    expect(list).toHaveLength(2);
    expect(list.filter((d) => d.current)).toHaveLength(1);
    await auth.security.signOutOtherDevices(a);
    expect(await auth.getUser(b)).toBeNull();
    expect(await auth.getUser(a)).toMatchObject({ email: "devices@example.com" });
  });

  it("security log and new-device email for staff (not for a browser seen before, not for customers)", async () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36";
    const signInWith = async (email: string) => {
      await auth.signInMagicLink({ email, callbackURL: "/admin", errorCallbackURL: "/login", clientKey: crypto.randomUUID() }, new Headers({ origin: BASE_URL }));
      await auth.handler(new Request(magicLinkFrom(t.sent.findLast((m) => m.to === email)!.text)!, { headers: { origin: BASE_URL, "user-agent": ua } }));
    };
    await signIn(t, "alert@example.com");
    await handle.db.update(users).set({ role: "admin" }).where(eq(users.email, "alert@example.com"));
    const before = t.sent.filter((m) => m.kind === "security_notice").length;
    await signInWith("alert@example.com");
    const notices = t.sent.filter((m) => m.kind === "security_notice");
    expect(notices).toHaveLength(before + 1);
    expect(notices.at(-1)!.text).toContain("Chrome · Windows");
    await signInWith("alert@example.com");
    expect(t.sent.filter((m) => m.kind === "security_notice")).toHaveLength(before + 1);

    await signInWith("customer@example.com");
    expect(t.sent.filter((m) => m.kind === "security_notice" && m.to === "customer@example.com")).toHaveLength(0);
    const [user] = await handle.db.select({ id: users.id }).from(users).where(eq(users.email, "alert@example.com"));
    expect((await handle.db.select().from(authEvents).where(eq(authEvents.userId, user!.id))).map((e) => e.kind)).toEqual(["sign_in", "sign_in", "sign_in"]);
  });
});
