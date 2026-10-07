import { describe, expect, it } from "vitest";
import { hasSecondFactor, isFresh, isStaffRole, staffGate, staffSessionExpired } from "./mfa";

const policy = { requireSecondFactor: true, sessionHours: 12, freshMinutes: 10 };
const now = new Date("2026-10-08T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("staff sign-in policy", () => {
  it("staff are editors and admins", () => {
    expect([isStaffRole("user"), isStaffRole("editor"), isStaffRole("admin")]).toEqual([false, true, true]);
  });

  it("staff sessions end after sessionHours; customer sessions do not", () => {
    const old = { createdAt: ago(12 * 60 + 1), secondFactorAt: null };
    const recent = { createdAt: ago(11 * 60), secondFactorAt: null };
    expect(staffSessionExpired("admin", old, policy, now)).toBe(true);
    expect(staffSessionExpired("editor", recent, policy, now)).toBe(false);
    expect(staffSessionExpired("user", old, policy, now)).toBe(false);
  });

  it("gate: enroll without a factor, verify until this session passed one, then ok", () => {
    const session = { createdAt: ago(5), secondFactorAt: null };
    expect(staffGate("editor", session, { passkeys: 0, totp: false }, policy)).toBe("enroll");
    expect(staffGate("editor", session, { passkeys: 1, totp: false }, policy)).toBe("verify");
    expect(staffGate("admin", { ...session, secondFactorAt: ago(1) }, { passkeys: 0, totp: true }, policy)).toBe("ok");
  });

  it("gate: customers, and a policy without the requirement, pass", () => {
    const session = { createdAt: ago(5), secondFactorAt: null };
    expect(staffGate("user", session, { passkeys: 0, totp: false }, policy)).toBe("ok");
    expect(staffGate("admin", session, { passkeys: 0, totp: false }, { ...policy, requireSecondFactor: false })).toBe("ok");
  });

  it("fresh: a second factor within freshMinutes", () => {
    expect(isFresh({ createdAt: ago(60), secondFactorAt: ago(9) }, policy, now)).toBe(true);
    expect(isFresh({ createdAt: ago(60), secondFactorAt: ago(11) }, policy, now)).toBe(false);
    expect(isFresh({ createdAt: ago(60), secondFactorAt: null }, policy, now)).toBe(false);
  });

  it("a passkey or an authenticator app counts as a second factor", () => {
    expect(hasSecondFactor({ passkeys: 0, totp: false })).toBe(false);
    expect(hasSecondFactor({ passkeys: 2, totp: false })).toBe(true);
    expect(hasSecondFactor({ passkeys: 0, totp: true })).toBe(true);
  });
});
