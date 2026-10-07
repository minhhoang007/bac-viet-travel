import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { and, count, eq, ne } from "drizzle-orm";
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
  methods: { magicLink: boolean; google: boolean };
  trustedProviders: string[];
  google?: { clientId: string; clientSecret: string };
  /** Disable Better Auth's built-in rate limiter (tests). */
  disableRateLimit?: boolean;
  staff: StaffAuthPolicy;
  /** Page (path, no origin) that asks before opening a magic link, so link scanners in mailboxes cannot use it up. */
  confirmSignInPath: string;
  /** Page (path) where the user manages passkeys, the authenticator app and devices; linked from security emails. */
  securityPath: string;
}

// Second-factor endpoints: a success marks the session (sessions.second_factor_at).
const SECOND_FACTOR_PATHS = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/passkey/verify-authentication"]);
// Adding, removing or changing a second factor: needs a fresh second factor once the account has one.
const FACTOR_CHANGE_PATHS = new Set(["/passkey/generate-register-options", "/passkey/delete-passkey", "/passkey/update-passkey", "/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes", "/two-factor/get-totp-uri"]);
const EVENT_OF_PATH: Record<string, AuthEventKind> = {
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
    emailAndPassword: { enabled: false },
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
            if (ctx?.path?.startsWith("/two-factor")) return; // enrolment rotates the session: not a sign-in
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
      // TOTP (authenticator app) and backup codes; this app has no passwords. Ten wrong codes lock it for 15 minutes.
      twoFactor({ issuer: deps.appName, allowPasswordless: true }),
      nextCookies(), // must be last
    ],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
