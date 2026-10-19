import { and, count, eq, isNotNull, ne } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { RateLimiter } from "@/core/security/rate-limit";
import type { TurnstileCheck } from "@/core/security/turnstile";
import { ROLES, users } from "@/core/users/schema";
import type { Db } from "@/db/client";
import type { BetterAuthInstance } from "./adapters/better-auth";
import { createAuthEvents, type AuthEvent } from "./events";
import { createLoginCodes } from "./login-code";
import { isFresh, staffGate, staffSessionExpired, type FactorFacts, type SessionFacts, type StaffAuthPolicy } from "./mfa";
import { accounts, passkeys, sessions, twoFactors } from "./schema";

export type Role = (typeof ROLES)[number];

/** Roles are ordered: each one includes the rights of those before it (admin ⊇ editor ⊇ user). */
export function hasRole(user: { role: Role }, required: Role): boolean {
  return ROLES.indexOf(user.role) >= ROLES.indexOf(required);
}

const toRole = (value: unknown): Role => (ROLES as readonly unknown[]).includes(value) ? (value as Role) : "user";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
}

export interface AuthSession {
  user: AuthUser;
  session: SessionFacts & { id: string };
}

export interface DeviceSession {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface PasskeyInfo {
  id: string;
  name: string | null;
  createdAt: Date | null;
}

/** Outcome of setting a password: "invalid" is a used or expired link (reset) or a password already set (set). */
export type PasswordResult = "done" | "too_short" | "too_long" | "compromised" | "invalid";

export interface AuthService {
  /** Sign-in methods actually available (config + credentials). */
  methods: { magicLink: boolean; google: boolean; password: boolean };
  /** Staff sign-in policy (config/auth.ts `staff`). */
  staffPolicy: StaffAuthPolicy;
  /** Current user, or null. Disabled users, and staff sessions older than staff.sessionHours, count as signed out. */
  getUser(headers: Headers): Promise<AuthUser | null>;
  /** Current user and session facts (second factor), with the same rules as getUser. */
  getSession(headers: Headers): Promise<AuthSession | null>;
  /** Throws AUTH_ERROR when not signed in. */
  requireUser(headers: Headers): Promise<AuthUser>;
  /** Throws AUTH_ERROR / PERMISSION_ERROR. Hierarchical: requireRole(h, "editor") also admits admins. */
  requireRole(headers: Headers, role: Role): Promise<AuthUser>;
  /** Passkeys and authenticator app of a user. */
  factors(userId: string): Promise<FactorFacts>;
  /** Admin area gate for this session: "ok", "enroll" (no second factor yet) or "verify" (not passed this session). */
  staffGate(current: AuthSession): Promise<"ok" | "enroll" | "verify">;
  /** The session passed a second factor within staff.freshMinutes (step-up before sensitive actions). */
  isFresh(current: AuthSession): boolean;
  /**
   * Rate limited per client and per recipient (throws RATE_LIMIT_ERROR). Server-side `auth.api.*` calls bypass
   * Better Auth's HTTP limiter, so the limit lives here. errorCallbackURL receives `?error=...` for bad links.
   * With Turnstile configured, a missing or failed token throws CAPTCHA_ERROR.
   */
  signInMagicLink(input: MagicLinkRequest, headers: Headers): Promise<void>;
  /** The one-time sign-in link a 6-digit email code stands for, or null (rate limited per client and recipient). */
  redeemLoginCode(input: { email: string; code: string; clientKey: string }): Promise<string | null>;
  /**
   * DEMO_MODE only: the one-time sign-in link for a demo account (deps.demoAccounts), so visitors try the admin with
   * one click. Null for any other email, or when the account is missing or is not an editor (never an admin).
   */
  demoSignIn(email: string, callbackURL: string, headers: Headers): Promise<string | null>;
  /**
   * Email and password (methods.password). "second_factor": the password was right and the authenticator app is on,
   * so there is no session yet: the code on the verify page finishes the sign-in. Rate limited per client and per
   * address (RATE_LIMIT_ERROR); with Turnstile configured, a missing or failed token throws CAPTCHA_ERROR.
   * `setCookies`: the response cookies, for callers outside Next.js (in a server action they are already set).
   */
  signInPassword(input: PasswordSignIn, headers: Headers): Promise<{ status: "ok" | "second_factor" | "wrong"; setCookies: string[] }>;
  /** "Forgot password": emails a link to set a new one, to staff accounts only (silent otherwise). Rate limited. */
  requestPasswordReset(input: { email: string; clientKey: string; captchaToken?: string | null }): Promise<void>;
  /** An admin's invitation or reset: the same email, not rate limited (the caller checks who may send it). */
  sendPasswordSetup(email: string): Promise<void>;
  /** The new password from the emailed link. Signs the account out everywhere. */
  resetPassword(token: string, newPassword: string): Promise<PasswordResult>;
  /** The account with this email, created (plain user, email not verified) when missing. Returns its id. */
  ensureAccount(email: string): Promise<string>;
  /** A password sign-in waiting for its second factor (no session yet). */
  hasPendingSecondFactor(headers: Headers): boolean;
  /** Returns the provider URL to redirect to. */
  signInGoogle(callbackURL: string, headers: Headers): Promise<string>;
  signOut(headers: Headers): Promise<void>;
  security: SecurityApi;
  /** Raw HTTP handler for /api/auth/*. */
  handler(request: Request): Promise<Response>;
}

/**
 * Account security page (signed-in user, from request headers). Changing factors or the password needs a fresh second
 * factor. With a password set, the authenticator-app calls take it again (`password`); a wrong one throws
 * VALIDATION_ERROR.
 */
export interface SecurityApi {
  passkeys(headers: Headers): Promise<PasskeyInfo[]>;
  deletePasskey(headers: Headers, id: string): Promise<void>;
  /** Starts authenticator-app setup: the otpauth:// URI (QR code) and ten backup codes, shown once. */
  startTotp(headers: Headers, password?: string): Promise<{ totpURI: string; backupCodes: string[] }>;
  /**
   * A TOTP code: confirms the setup, or passes the second factor for this session (or finishes a password sign-in
   * waiting for it). False when wrong.
   */
  verifyTotp(headers: Headers, code: string): Promise<boolean>;
  /** A backup code (used once) as the second factor, like verifyTotp. False when wrong. */
  verifyBackupCode(headers: Headers, code: string): Promise<boolean>;
  disableTotp(headers: Headers, password?: string): Promise<void>;
  newBackupCodes(headers: Headers, password?: string): Promise<string[]>;
  hasPassword(userId: string): Promise<boolean>;
  /** First password for a signed-in staff account without one ("invalid" when it has one; PERMISSION_ERROR if not staff). */
  setPassword(headers: Headers, newPassword: string): Promise<PasswordResult>;
  /** "wrong": the current password does not match. Other devices are signed out. */
  changePassword(headers: Headers, currentPassword: string, newPassword: string): Promise<PasswordResult | "wrong">;
  devices(headers: Headers): Promise<DeviceSession[]>;
  signOutDevice(headers: Headers, sessionId: string): Promise<void>;
  signOutOtherDevices(headers: Headers): Promise<void>;
  events(userId: string): Promise<AuthEvent[]>;
}

export interface MagicLinkRequest {
  email: string;
  callbackURL: string;
  errorCallbackURL: string;
  /** Client identifier for rate limiting (usually the IP). */
  clientKey: string;
  /** Turnstile token from the form (required when Turnstile is configured). */
  captchaToken?: string | null;
}

export interface PasswordSignIn {
  email: string;
  password: string;
  /** Client identifier for rate limiting (usually the IP). */
  clientKey: string;
  captchaToken?: string | null;
}

export interface AuthRateLimits {
  perClient: RateLimiter;
  perRecipient: RateLimiter;
  /** Password attempts, per client and per address (keys "password:client:…", "password:to:…"). */
  password?: RateLimiter;
  /** Second-factor code attempts per account (TOTP and backup codes): no unlimited guessing with a stolen email. */
  secondFactor?: RateLimiter;
}

export interface AuthServiceDeps {
  db: Db;
  secret: string;
  staff: StaffAuthPolicy;
  turnstile?: TurnstileCheck;
  now?: () => Date;
  /**
   * DEMO_MODE only: emails of the demo staff accounts. They sign in with one click and skip the second factor (the
   * whole site is a demo). Never set on a real site.
   */
  demoAccounts?: readonly string[];
}

// Better Auth error codes that mean "wrong code" (not an outage).
const isWrongCode = (error: unknown) => {
  const status = (error as { statusCode?: number; status?: number | string })?.statusCode ?? (error as { status?: number | string })?.status;
  return status === 401 || status === 400 || status === "UNAUTHORIZED" || status === "BAD_REQUEST";
};

// Better Auth's error code (APIError body), e.g. "PASSWORD_TOO_SHORT".
const codeOf = (error: unknown) => (error as { body?: { code?: string } })?.body?.code;

/** Better Auth's password errors as outcomes; anything else (outage, breach check down, fresh 2FA needed) propagates. */
function passwordOutcome(error: unknown): PasswordResult | "wrong" {
  switch (codeOf(error)) {
    case "PASSWORD_TOO_SHORT":
      return "too_short";
    case "PASSWORD_TOO_LONG":
      return "too_long";
    case "PASSWORD_COMPROMISED":
      return "compromised";
    case "INVALID_TOKEN":
    case "USER_NOT_FOUND":
    case "PASSWORD_ALREADY_SET":
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "invalid";
    case "INVALID_PASSWORD":
      return "wrong";
    default:
      throw error;
  }
}

// Better Auth endpoints never served over HTTP here (see `handler`).
const SERVICE_ONLY = /\/(sign-in\/magic-link|sign-in\/email|sign-up\/email|request-password-reset|forget-password|reset-password|change-password|set-password|verify-password)(\/|$)/;

// The cookie Better Auth sets when a password was right and the authenticator-app code is still to come.
const PENDING_SECOND_FACTOR = /(?:^|;\s*)(?:__Secure-)?better-auth\.two_factor=/;

export function createAuthService(
  auth: BetterAuthInstance,
  methods: AuthService["methods"],
  limits: AuthRateLimits,
  deps: AuthServiceDeps,
): AuthService {
  const { db } = deps;
  const now = () => deps.now?.() ?? new Date();
  const loginCodes = createLoginCodes({ db, secret: deps.secret, now: deps.now });
  const events = createAuthEvents({ db, now: deps.now });

  const getSession = async (headers: Headers): Promise<AuthSession | null> => {
    const found = await auth.api.getSession({ headers });
    if (!found) return null;
    const u = found.user as typeof found.user & { role?: string; status?: string };
    if (u.status === "disabled") return null;
    const s = found.session as typeof found.session & { secondFactorAt?: Date | string | null };
    const session = { id: s.id, createdAt: new Date(s.createdAt), secondFactorAt: s.secondFactorAt ? new Date(s.secondFactorAt) : null };
    const role = toRole(u.role);
    if (staffSessionExpired(role, session, deps.staff, now())) {
      // Staff sessions end after staff.sessionHours: drop it, the cookie then points at nothing.
      await db.delete(sessions).where(eq(sessions.id, session.id));
      return null;
    }
    return { user: { id: u.id, email: u.email, name: u.name, image: u.image ?? null, role }, session };
  };

  const getUser = async (headers: Headers) => (await getSession(headers))?.user ?? null;
  const isDemoAccount = (email: string) => deps.demoAccounts?.includes(email.trim().toLowerCase()) ?? false;

  const requireUser = async (headers: Headers) => {
    const user = await getUser(headers);
    if (!user) throw new AppError("AUTH_ERROR");
    return user;
  };

  const factors = async (userId: string): Promise<FactorFacts> => {
    const [[p], [t]] = await Promise.all([
      db.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, userId)),
      db.select({ n: count() }).from(twoFactors).where(and(eq(twoFactors.userId, userId), ne(twoFactors.verified, false))),
    ]);
    return { passkeys: p?.n ?? 0, totp: (t?.n ?? 0) > 0 };
  };

  // The authenticator-app calls with an account's password: a wrong one is the user's mistake, not an outage.
  const withPassword = async <T,>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (codeOf(error) === "INVALID_PASSWORD") throw new AppError("VALIDATION_ERROR", "Wrong password", { details: { field: "password" } });
      throw error;
    }
  };

  const sendPasswordSetup = async (email: string) => {
    await auth.api.requestPasswordReset({ body: { email: email.trim().toLowerCase() } });
  };

  const hasPendingSecondFactor = (headers: Headers) => PENDING_SECOND_FACTOR.test(headers.get("cookie") ?? "");

  // Limited per account (RATE_LIMIT_ERROR); a wrong code is false; anything else (outage) propagates. A password
  // sign-in waiting for its code has no session yet: Better Auth counts those attempts on its own short-lived cookie.
  const codeCheck = async (headers: Headers, run: () => Promise<unknown>): Promise<boolean> => {
    const current = await getSession(headers);
    if (!current && !hasPendingSecondFactor(headers)) throw new AppError("AUTH_ERROR");
    if (current && limits.secondFactor && !(await limits.secondFactor.limit(`second-factor:${current.user.id}`)).success) throw new AppError("RATE_LIMIT_ERROR");
    try {
      await run();
      return true;
    } catch (error) {
      // A password sign-in out of code attempts: only signing in again helps (not "wrong code" forever).
      if (codeOf(error) === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") throw new AppError("RATE_LIMIT_ERROR", "Sign in again");
      if (isWrongCode(error)) return false;
      throw error;
    }
  };

  const security: SecurityApi = {
    async passkeys(headers) {
      const rows = await auth.api.listPasskeys({ headers });
      return rows.map((p) => ({ id: p.id, name: p.name ?? null, createdAt: p.createdAt ? new Date(p.createdAt) : null }));
    },
    async deletePasskey(headers, id) {
      await auth.api.deletePasskey({ headers, body: { id } });
    },
    async startTotp(headers, password) {
      const res = await withPassword(() => auth.api.enableTwoFactor({ headers, body: { password } }));
      if (res.method !== "totp") throw new AppError("INTERNAL_ERROR", "TOTP setup unavailable");
      return { totpURI: res.totpURI, backupCodes: res.backupCodes };
    },
    verifyTotp: (headers, code) => codeCheck(headers, () => auth.api.verifyTOTP({ headers, body: { code } })),
    verifyBackupCode: (headers, code) => codeCheck(headers, () => auth.api.verifyBackupCode({ headers, body: { code } })),
    async disableTotp(headers, password) {
      await withPassword(() => auth.api.disableTwoFactor({ headers, body: { password } }));
    },
    async newBackupCodes(headers, password) {
      const res = await withPassword(() => auth.api.generateBackupCodes({ headers, body: { password } }));
      return res.backupCodes;
    },
    async hasPassword(userId) {
      const [row] = await db
        .select({ n: count() })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"), isNotNull(accounts.password)));
      return (row?.n ?? 0) > 0;
    },
    async setPassword(headers, newPassword) {
      // Passwords are for staff: a customer account keeps signing in by email link, Google or passkey.
      const current = await getSession(headers);
      if (!current) throw new AppError("AUTH_ERROR");
      if (!hasRole(current.user, "editor")) throw new AppError("PERMISSION_ERROR");
      try {
        await auth.api.setPassword({ headers, body: { newPassword } });
        return "done";
      } catch (error) {
        return passwordOutcome(error) as PasswordResult;
      }
    },
    async changePassword(headers, currentPassword, newPassword) {
      const current = await getSession(headers);
      if (!current) throw new AppError("AUTH_ERROR");
      try {
        await auth.api.changePassword({ headers, body: { currentPassword, newPassword } });
      } catch (error) {
        return passwordOutcome(error);
      }
      // Here rather than Better Auth's revokeOtherSessions, which also replaces this session (losing its second factor).
      await db.delete(sessions).where(and(eq(sessions.userId, current.user.id), ne(sessions.id, current.session.id)));
      return "done";
    },
    async devices(headers) {
      const current = await getSession(headers);
      if (!current) return [];
      const rows = await db
        .select({ id: sessions.id, userAgent: sessions.userAgent, ipAddress: sessions.ipAddress, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.userId, current.user.id));
      // Staff sessions past staff.sessionHours are over even if not yet deleted (that happens when next used).
      return rows
        .filter((r) => r.expiresAt > now() && !staffSessionExpired(current.user.role, { createdAt: r.createdAt, secondFactorAt: null }, deps.staff, now()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => ({ id: r.id, current: r.id === current.session.id, userAgent: r.userAgent, ipAddress: r.ipAddress, createdAt: r.createdAt }));
    },
    async signOutDevice(headers, sessionId) {
      const current = await getSession(headers);
      if (!current) throw new AppError("AUTH_ERROR");
      await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, current.user.id)));
    },
    async signOutOtherDevices(headers) {
      const current = await getSession(headers);
      if (!current) throw new AppError("AUTH_ERROR");
      await db.delete(sessions).where(and(eq(sessions.userId, current.user.id), ne(sessions.id, current.session.id)));
    },
    events: (userId) => events.recent(userId),
  };

  return {
    methods,
    staffPolicy: deps.staff,
    getUser,
    getSession,
    requireUser,
    async requireRole(headers, role) {
      const user = await requireUser(headers);
      if (!hasRole(user, role)) throw new AppError("PERMISSION_ERROR");
      return user;
    },
    factors,
    async staffGate(current) {
      if (isDemoAccount(current.user.email)) return "ok";
      return staffGate(current.user.role, current.session, await factors(current.user.id), deps.staff);
    },
    isFresh: (current) => isDemoAccount(current.user.email) || isFresh(current.session, deps.staff, now()),
    async demoSignIn(email, callbackURL, headers) {
      if (!isDemoAccount(email)) return null;
      const address = email.trim().toLowerCase();
      // Only an existing editor (set up by the project's demo data): a visitor never gets an admin or a new account.
      const [user] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.email, address));
      if (!user || user.role !== "editor" || user.status === "disabled") return null;
      // The regular magic-link flow (its email lands in the demo mailbox); the link is taken from the login code
      // issued with it, so the browser goes straight to Better Auth's verify URL, which creates the session.
      await auth.api.signInMagicLink({ body: { email: address, callbackURL }, headers });
      return loginCodes.take(address);
    },
    async signInMagicLink({ email, callbackURL, errorCallbackURL, clientKey, captchaToken }, headers) {
      const [client, recipient] = await Promise.all([
        limits.perClient.limit(`magic-link:client:${clientKey}`),
        limits.perRecipient.limit(`magic-link:to:${email.trim().toLowerCase()}`),
      ]);
      if (!client.success || !recipient.success) throw new AppError("RATE_LIMIT_ERROR");
      if (deps.turnstile && !(await deps.turnstile(captchaToken, clientKey))) throw new AppError("CAPTCHA_ERROR");
      await auth.api.signInMagicLink({ body: { email, callbackURL, errorCallbackURL }, headers });
    },
    async redeemLoginCode({ email, code, clientKey }) {
      const [client, recipient] = await Promise.all([
        limits.perClient.limit(`login-code:client:${clientKey}`),
        limits.perRecipient.limit(`login-code:to:${email.trim().toLowerCase()}`),
      ]);
      if (!client.success || !recipient.success) throw new AppError("RATE_LIMIT_ERROR");
      return loginCodes.redeem(email, code.trim());
    },
    async signInPassword({ email, password, clientKey, captchaToken }, headers) {
      if (!methods.password) throw new AppError("MODULE_DISABLED", "Password sign-in is off");
      const address = email.trim().toLowerCase();
      if (limits.password) {
        const [client, account] = await Promise.all([limits.password.limit(`password:client:${clientKey}`), limits.password.limit(`password:to:${address}`)]);
        if (!client.success || !account.success) throw new AppError("RATE_LIMIT_ERROR");
      }
      if (deps.turnstile && !(await deps.turnstile(captchaToken, clientKey))) throw new AppError("CAPTCHA_ERROR");
      // A disabled account reads as a wrong password (getSession would drop its session anyway).
      const [user] = await db.select({ status: users.status }).from(users).where(eq(users.email, address));
      if (user?.status === "disabled") return { status: "wrong", setCookies: [] };
      try {
        const res = await auth.api.signInEmail({ body: { email: address, password }, headers, returnHeaders: true });
        const pending = "twoFactorRedirect" in res.response && Boolean(res.response.twoFactorRedirect);
        return { status: pending ? "second_factor" : "ok", setCookies: res.headers.getSetCookie() };
      } catch (error) {
        if (isWrongCode(error)) return { status: "wrong", setCookies: [] };
        throw error;
      }
    },
    async requestPasswordReset({ email, clientKey, captchaToken }) {
      if (!methods.password) throw new AppError("MODULE_DISABLED", "Password sign-in is off");
      const address = email.trim().toLowerCase();
      const [client, recipient] = await Promise.all([limits.perClient.limit(`password-reset:client:${clientKey}`), limits.perRecipient.limit(`password-reset:to:${address}`)]);
      if (!client.success || !recipient.success) throw new AppError("RATE_LIMIT_ERROR");
      if (deps.turnstile && !(await deps.turnstile(captchaToken, clientKey))) throw new AppError("CAPTCHA_ERROR");
      await sendPasswordSetup(address);
    },
    async sendPasswordSetup(email) {
      if (!methods.password) throw new AppError("MODULE_DISABLED", "Password sign-in is off");
      await sendPasswordSetup(email);
    },
    async resetPassword(token, newPassword) {
      try {
        await auth.api.resetPassword({ body: { token, newPassword } });
        return "done";
      } catch (error) {
        return passwordOutcome(error) as PasswordResult;
      }
    },
    async ensureAccount(email) {
      const address = email.trim().toLowerCase();
      await db.insert(users).values({ email: address, name: address.split("@")[0] ?? "" }).onConflictDoNothing({ target: users.email });
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, address));
      if (!row) throw new AppError("INTERNAL_ERROR", "Account not created");
      return row.id;
    },
    hasPendingSecondFactor,
    async signInGoogle(callbackURL, headers) {
      const res = await auth.api.signInSocial({ body: { provider: "google", callbackURL }, headers });
      if (!res.url) throw new AppError("AUTH_ERROR", "Google sign-in unavailable");
      return res.url;
    },
    async signOut(headers) {
      await auth.api.signOut({ headers });
    },
    security,
    handler: (request) =>
      // Magic links and passwords only through this service: the HTTP endpoints would skip its CAPTCHA, per-address
      // limits and staff-only rules.
      SERVICE_ONLY.test(new URL(request.url).pathname) ? Promise.resolve(new Response("Not found", { status: 404 })) : auth.handler(request),
  };
}
