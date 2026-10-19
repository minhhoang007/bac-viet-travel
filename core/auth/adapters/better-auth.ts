import { AsyncLocalStorage } from "node:async_hooks";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { and, count, eq, like, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { MailPort } from "@/core/ports/mail";
import { users } from "@/core/users/schema";
import { createAuthEvents, deviceLabel } from "../events";
import { createLoginCodes } from "../login-code";
import { isFresh, isStaffRole, type StaffAuthPolicy } from "../mfa";
import { accounts, passkeys, sessions, twoFactors, verifications, type AuthEventKind } from "../schema";

export interface BetterAuthDeps {
  appName: string;
  db: Db;
  mail: MailPort;
  secret: string;
  baseURL: string;
  methods: { magicLink: boolean; google: boolean; password: boolean };
  trustedProviders: string[];
  google?: { clientId: string; clientSecret: string };
  /** Disable Better Auth's built-in rate limiter (tests). */
  disableRateLimit?: boolean;
  staff: StaffAuthPolicy;
  /** Page (path, no origin) that asks before opening a magic link, so link scanners in mailboxes cannot use it up. */
  confirmSignInPath: string;
  /** Page (path) where the user manages passkeys, the authenticator app and devices; linked from security emails. */
  securityPath: string;
  /** Page (path) where a staff member sets a new password from the emailed link (`?token=`). */
  resetPasswordPath: string;
  /** New passwords are checked against known breaches (Have I Been Pwned, k-anonymity). Off in tests (network). */
  checkBreachedPasswords: boolean;
}

/** Password length: 12 at least (NIST 800-63B with no composition rules), 128 at most (hashing cost). */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
// An invitation (sent by an admin) is often opened the next day: 24 hours. "Forgot password" (anyone may ask for it
// for any address): 4 hours.
const INVITE_LINK_HOURS = 24;
const FORGOT_LINK_HOURS = 4;

/** Runs `send` as an admin's invitation: the emailed link lasts INVITE_LINK_HOURS instead of FORGOT_LINK_HOURS. */
export const asInvitation = <T,>(send: () => Promise<T>): Promise<T> => invitation.run(true, send);
const invitation = new AsyncLocalStorage<true>();

/** Drops every unused set-password link of the user (after a password is set, changed or reset). */
export const dropPasswordLinks = (db: Db, userId: string) => db.delete(verifications).where(and(eq(verifications.value, userId), like(verifications.identifier, "reset-password:%")));

// Second-factor endpoints: a success marks the session (sessions.second_factor_at).
const SECOND_FACTOR_PATHS = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/passkey/verify-authentication"]);
// Adding, removing or changing a second factor: needs a fresh second factor once the account has one.
// The password counts as a security change too: a stolen session cannot replace it without the second factor.
const FACTOR_CHANGE_PATHS = new Set(["/passkey/generate-register-options", "/passkey/delete-passkey", "/passkey/update-passkey", "/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes", "/two-factor/get-totp-uri", "/change-password", "/set-password"]);
const EVENT_OF_PATH: Record<string, AuthEventKind> = {
  "/change-password": "password_changed",
  "/set-password": "password_set",
  "/passkey/verify-registration": "passkey_added",
  "/passkey/delete-passkey": "passkey_removed",
  "/two-factor/disable": "totp_disabled",
  "/two-factor/generate-backup-codes": "backup_codes_new",
  "/two-factor/verify-backup-code": "backup_code_used",
};

const failed = (returned: unknown) => returned instanceof Error || returned instanceof Response;

export function createBetterAuth(deps: BetterAuthDeps) {
  const { db } = deps;
  const events = createAuthEvents({ db });
  const loginCodes = createLoginCodes({ db, secret: deps.secret });
  const securityUrl = `${deps.baseURL}${deps.securityPath}`;

  const factorCount = async (userId: string) => {
    const [[p], [t]] = await Promise.all([
      db.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, userId)),
      // An authenticator app counts once confirmed: a setup started but not finished must not block finishing it.
      db.select({ n: count() }).from(twoFactors).where(and(eq(twoFactors.userId, userId), ne(twoFactors.verified, false))),
    ]);
    return (p?.n ?? 0) + (t?.n ?? 0);
  };

  // Security emails never block the request they follow.
  const notify = async (to: string, subject: string, text: string) => {
    try {
      await deps.mail.send({ kind: "security_notice", to, subject, text });
    } catch {
      // Mail outage: the event is still in the account's security log.
    }
  };

  const factorChanged = async (user: { id: string; email: string }, kind: AuthEventKind, client: { ipAddress?: string | null; userAgent?: string | null }) => {
    await events.record(user.id, kind, client);
    await notify(
      user.email,
      "Bảo mật tài khoản đã thay đổi / Account security changed",
      `Tài khoản của bạn vừa có thay đổi bảo mật (${kind}). Nếu không phải bạn, hãy vào trang bảo mật ngay và báo quản trị viên.\nYour account security just changed (${kind}). If this was not you, open the security page now and tell an administrator.\n\n${securityUrl}`,
    );
  };

  // Every sign-in goes to the security log; staff get an email for a browser not seen in 90 days.
  const signedIn = async (session: { userId: string; ipAddress?: string | null; userAgent?: string | null }) => {
    try {
      const client = { ipAddress: session.ipAddress, userAgent: session.userAgent };
      const isNew = await events.isNewDevice(session.userId, session.userAgent);
      await events.record(session.userId, "sign_in", client);
      const [user] = await db.select({ email: users.email, role: users.role }).from(users).where(eq(users.id, session.userId));
      if (user && isNew && isStaffRole(user.role)) {
        const when = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
        await notify(
          user.email,
          "Đăng nhập từ thiết bị mới / New sign-in",
          `Tài khoản của bạn vừa đăng nhập từ thiết bị mới: ${deviceLabel(session.userAgent)}, ${when}${session.ipAddress ? `, IP ${session.ipAddress}` : ""}.\nIf this was not you, sign out that device and tell an administrator:\n\n${securityUrl}`,
        );
      }
    } catch {
      // Never fail a sign-in because of the security log.
    }
  };

  return betterAuth({
    appName: deps.appName,
    baseURL: deps.baseURL,
    secret: deps.secret,
    trustedOrigins: [deps.baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications, passkeys, twoFactors },
    }),
    advanced: {
      // Postgres generates UUIDv7 ids (db/columns.ts).
      database: { generateId: false },
    },
    emailAndPassword: {
      enabled: deps.methods.password,
      // No sign-up with a password: an account exists first (invitation), then its owner sets one from an email.
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // The longest link; a "forgot password" link is shortened when it is sent (below).
      resetPasswordTokenExpiresIn: INVITE_LINK_HOURS * 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        // Staff only: a customer account never gets a password (its email stays silent, like an unknown address).
        if (!isStaffRole((user as { role?: string }).role ?? "user")) return;
        const hours = invitation.getStore() ? INVITE_LINK_HOURS : FORGOT_LINK_HOURS;
        // Better Auth stored the token (at the longest lifetime) before calling this.
        if (hours < INVITE_LINK_HOURS) await db.update(verifications).set({ expiresAt: new Date(Date.now() + hours * 3_600_000) }).where(eq(verifications.identifier, `reset-password:${token}`));
        const link = `${deps.baseURL}${deps.resetPasswordPath}?token=${encodeURIComponent(token)}`;
        await deps.mail.send({
          kind: "password_setup",
          to: user.email,
          subject: "Đặt mật khẩu / Set your password",
          text: `Mở liên kết để đặt mật khẩu cho tài khoản ${deps.appName} (hết hạn sau ${hours} giờ, dùng một lần):\nOpen the link to set the password of your ${deps.appName} account (expires in ${hours} hours, works once):\n\n${link}\n\nKhông phải bạn yêu cầu? Bỏ qua email này, mật khẩu cũ vẫn giữ nguyên. / Did not ask for it? Ignore this email: nothing changes.`,
        });
      },
      onPasswordReset: async ({ user }, request) => {
        // Opening the emailed link proves the address (Google may then link to this account).
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
        // The link just used is spent; older ones (an earlier invitation or request) must not work any more.
        await dropPasswordLinks(db, user.id);
        await factorChanged(user, "password_set", { ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: request?.headers.get("user-agent") ?? null });
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "user" },
        status: { type: "string", input: false, defaultValue: "active" },
      },
    },
    session: {
      additionalFields: { secondFactorAt: { type: "date", required: false, input: false } },
    },
    account: {
      accountLinking: {
        // Link only verified emails from trusted providers (SECURITY.md).
        enabled: true,
        trustedProviders: deps.trustedProviders,
        requireLocalEmailVerified: true,
      },
    },
    socialProviders:
      deps.methods.google && deps.google
        ? { google: { clientId: deps.google.clientId, clientSecret: deps.google.clientSecret } }
        : {},
    rateLimit: { enabled: !deps.disableRateLimit },
    databaseHooks: {
      session: {
        create: {
          // Every sign-in goes to the security log; staff get an email for a browser not seen in 90 days.
          after: async (session, ctx) => {
            // Second-factor endpoints: enrolment rotates the session (not a sign-in); a sign-in finished there after a
            // password is logged by the "after" hook below.
            if (ctx?.path?.startsWith("/two-factor")) return;
            // A password with the authenticator app on: this session is dropped at once for the code step (Better Auth).
            if (ctx?.path === "/sign-in/email") {
              const [u] = await db.select({ on: users.twoFactorEnabled }).from(users).where(eq(users.id, session.userId));
              if (u?.on) return;
            }
            await signedIn(session);
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!FACTOR_CHANGE_PATHS.has(ctx.path)) return;
        const current = await getSessionFromCtx(ctx);
        if (!current) return; // the endpoint itself rejects a missing session
        const secondFactorAt = (current.session as { secondFactorAt?: Date | string | null }).secondFactorAt;
        const facts = { createdAt: new Date(current.session.createdAt), secondFactorAt: secondFactorAt ? new Date(secondFactorAt) : null };
        // First factor setup is allowed with the sign-in alone; after that, only with a fresh second factor.
        if ((await factorCount(current.user.id)) > 0 && !isFresh(facts, deps.staff)) {
          throw new APIError("FORBIDDEN", { message: "Second factor required", code: "FRESH_SECOND_FACTOR_REQUIRED" });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const path = ctx.path;
        if (failed(ctx.context.returned)) return;
        const client = { ipAddress: ctx.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: ctx.headers?.get("user-agent") ?? null };

        if (SECOND_FACTOR_PATHS.has(path)) {
          const previous = await getSessionFromCtx(ctx).catch(() => null);
          const fresh = ctx.context.newSession ?? previous;
          if (!fresh) return;
          await db.update(sessions).set({ secondFactorAt: new Date() }).where(eq(sessions.id, fresh.session.id));
          // No session before: the sign-in started with a password and finishes with this code.
          if (!previous && ctx.context.newSession && path !== "/passkey/verify-authentication") await signedIn(ctx.context.newSession.session);
          // A passkey check opens a new session: close the one it replaces (same user) so it does not linger.
          if (previous && ctx.context.newSession && previous.session.id !== ctx.context.newSession.session.id && previous.user.id === ctx.context.newSession.user.id) {
            await db.delete(sessions).where(eq(sessions.id, previous.session.id));
          }
          // Enrolment: the first correct code confirms the authenticator app (and rotates the session).
          if (path === "/two-factor/verify-totp" && ctx.context.newSession) await factorChanged(fresh.user, "totp_enabled", client);
          if (path === "/two-factor/verify-backup-code") await factorChanged(fresh.user, "backup_code_used", client);
          return;
        }
        const kind = EVENT_OF_PATH[path];
        if (kind && kind !== "backup_code_used") {
          const current = await getSessionFromCtx(ctx).catch(() => null);
          if (current) await factorChanged(current.user, kind, client);
        }
      }),
    },
    plugins: [
      ...(deps.methods.magicLink
        ? [
            magicLink({
              expiresIn: 60 * 10,
              sendMagicLink: async ({ email, url }) => {
                // The email links to a confirmation page (scanners only GET it), and carries a code for another device.
                const confirm = `${deps.baseURL}${deps.confirmSignInPath}?link=${encodeURIComponent(url)}`;
                const code = await loginCodes.issue(email, url);
                await deps.mail.send({
                  kind: "magic_link",
                  to: email,
                  subject: `Mã đăng nhập ${code} / Sign-in code`,
                  text: `Nhấn vào liên kết rồi bấm "Đăng nhập" (hết hạn sau 10 phút):\nOpen the link, then press "Sign in" (expires in 10 minutes):\n\n${confirm}\n\nĐăng nhập trên thiết bị khác? Nhập mã: ${code}\nSigning in on another device? Enter the code: ${code}\n\nKhông phải bạn yêu cầu? Bỏ qua email này. / Did not ask for it? Ignore this email.`,
                });
              },
            }),
          ]
        : []),
      passkey({
        rpID: new URL(deps.baseURL).hostname,
        rpName: deps.appName,
        origin: deps.baseURL,
        // Face ID, fingerprint or device PIN on every use: possession plus the person, i.e. two factors in one.
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        registration: {
          afterVerification: async ({ verification }) => {
            if (!verification.registrationInfo?.userVerified) throw new APIError("BAD_REQUEST", { message: "User verification required", code: "USER_VERIFICATION_REQUIRED" });
            return undefined;
          },
        },
        authentication: {
          afterVerification: async ({ verification }) => {
            if (!verification.authenticationInfo.userVerified) throw new APIError("UNAUTHORIZED", { message: "User verification required", code: "USER_VERIFICATION_REQUIRED" });
          },
        },
      }),
      // TOTP (authenticator app) and backup codes. Ten wrong codes lock it for 15 minutes. An account with a password
      // must give it again to set up, turn off or renew these (Better Auth); without one, the session is enough.
      twoFactor({ issuer: deps.appName, allowPasswordless: true }),
      haveIBeenPwned({
        enabled: deps.methods.password && deps.checkBreachedPasswords,
        // Every way a password is set here (sign-up is off). The check fails closed: no answer, no new password.
        paths: ["/reset-password", "/change-password", "/set-password"],
      }),
      nextCookies(), // must be last
    ],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
