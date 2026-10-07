import { and, count, eq, ne } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { RateLimiter } from "@/core/security/rate-limit";
import type { TurnstileCheck } from "@/core/security/turnstile";
import { ROLES } from "@/core/users/schema";
import type { Db } from "@/db/client";
import type { BetterAuthInstance } from "./adapters/better-auth";
import { createAuthEvents, type AuthEvent } from "./events";
import { createLoginCodes } from "./login-code";
import { isFresh, staffGate, staffSessionExpired, type FactorFacts, type SessionFacts, type StaffAuthPolicy } from "./mfa";
import { passkeys, sessions, twoFactors } from "./schema";

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

export interface AuthService {
  /** Sign-in methods actually available (config + credentials). */
  methods: { magicLink: boolean; google: boolean };
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
  /** Returns the provider URL to redirect to. */
  signInGoogle(callbackURL: string, headers: Headers): Promise<string>;
  signOut(headers: Headers): Promise<void>;
  security: SecurityApi;
  /** Raw HTTP handler for /api/auth/*. */
  handler(request: Request): Promise<Response>;
}

/** Account security page (signed-in user, from request headers). Changing factors needs a fresh second factor. */
export interface SecurityApi {
  passkeys(headers: Headers): Promise<PasskeyInfo[]>;
  deletePasskey(headers: Headers, id: string): Promise<void>;
  /** Starts authenticator-app setup: the otpauth:// URI (QR code) and ten backup codes, shown once. */
  startTotp(headers: Headers): Promise<{ totpURI: string; backupCodes: string[] }>;
  /** A TOTP code: confirms the setup, or passes the second factor for this session. False when wrong. */
  verifyTotp(headers: Headers, code: string): Promise<boolean>;
  /** A backup code (used once) as the second factor for this session. False when wrong. */
  verifyBackupCode(headers: Headers, code: string): Promise<boolean>;
  disableTotp(headers: Headers): Promise<void>;
  newBackupCodes(headers: Headers): Promise<string[]>;
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

export interface AuthRateLimits {
  perClient: RateLimiter;
  perRecipient: RateLimiter;
  /** Second-factor code attempts per account (TOTP and backup codes): no unlimited guessing with a stolen email. */
  secondFactor?: RateLimiter;
}

export interface AuthServiceDeps {
  db: Db;
  secret: string;
  staff: StaffAuthPolicy;
  turnstile?: TurnstileCheck;
  now?: () => Date;
}

// Better Auth error codes that mean "wrong code" (not an outage).
const isWrongCode = (error: unknown) => {
  const status = (error as { statusCode?: number; status?: number | string })?.statusCode ?? (error as { status?: number | string })?.status;
  return status === 401 || status === 400 || status === "UNAUTHORIZED" || status === "BAD_REQUEST";
};

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

  // Limited per account (RATE_LIMIT_ERROR); a wrong code is false; anything else (outage) propagates.
  const codeCheck = async (headers: Headers, run: () => Promise<unknown>): Promise<boolean> => {
    const current = await getSession(headers);
    if (!current) throw new AppError("AUTH_ERROR");
    if (limits.secondFactor && !(await limits.secondFactor.limit(`second-factor:${current.user.id}`)).success) throw new AppError("RATE_LIMIT_ERROR");
    try {
      await run();
      return true;
    } catch (error) {
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
    async startTotp(headers) {
      const res = await auth.api.enableTwoFactor({ headers, body: {} });
      if (res.method !== "totp") throw new AppError("INTERNAL_ERROR", "TOTP setup unavailable");
      return { totpURI: res.totpURI, backupCodes: res.backupCodes };
    },
    verifyTotp: (headers, code) => codeCheck(headers, () => auth.api.verifyTOTP({ headers, body: { code } })),
    verifyBackupCode: (headers, code) => codeCheck(headers, () => auth.api.verifyBackupCode({ headers, body: { code } })),
    async disableTotp(headers) {
      await auth.api.disableTwoFactor({ headers, body: {} });
    },
    async newBackupCodes(headers) {
      const res = await auth.api.generateBackupCodes({ headers, body: {} });
      return res.backupCodes;
    },
    async devices(headers) {
      const current = await getSession(headers);
      if (!current) return [];
      const rows = await db
        .select({ id: sessions.id, userAgent: sessions.userAgent, ipAddress: sessions.ipAddress, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.userId, current.user.id));
      return rows
        .filter((r) => r.expiresAt > now())
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
      return staffGate(current.user.role, current.session, await factors(current.user.id), deps.staff);
    },
    isFresh: (current) => isFresh(current.session, deps.staff, now()),
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
    async signInGoogle(callbackURL, headers) {
      const res = await auth.api.signInSocial({ body: { provider: "google", callbackURL }, headers });
      if (!res.url) throw new AppError("AUTH_ERROR", "Google sign-in unavailable");
      return res.url;
    },
    async signOut(headers) {
      await auth.api.signOut({ headers });
    },
    security,
    handler: (request) => auth.handler(request),
  };
}
