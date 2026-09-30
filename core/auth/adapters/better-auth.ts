import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import type { Db } from "@/db/client";
import type { MailPort } from "@/core/ports/mail";
import { users } from "@/core/users/schema";
import { accounts, sessions, verifications } from "../schema";

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
}

export function createBetterAuth(deps: BetterAuthDeps) {
  return betterAuth({
    appName: deps.appName,
    baseURL: deps.baseURL,
    secret: deps.secret,
    trustedOrigins: [deps.baseURL],
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
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
    plugins: [
      ...(deps.methods.magicLink
        ? [
            magicLink({
              expiresIn: 60 * 10,
              sendMagicLink: async ({ email, url }) => {
                await deps.mail.send({
                  kind: "magic_link",
                  to: email,
                  subject: "Đăng nhập / Sign in",
                  text: `Nhấn vào liên kết để đăng nhập (hết hạn sau 10 phút):\nClick the link to sign in (expires in 10 minutes):\n\n${url}`,
                });
              },
            }),
          ]
        : []),
      nextCookies(), // must be last
    ],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
