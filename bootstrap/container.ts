import { createAccountService, type AccountService } from "@/core/account";
import { createAuthService, type AuthRateLimits, type AuthService } from "@/core/auth";
import { createBetterAuth } from "@/core/auth/adapters/better-auth";
import { createContactService, type ContactService } from "@/core/contact";
import { createLogger, type Logger } from "@/core/logger";
import type { Features } from "@/core/module";
import { noopMail, type MailPort } from "@/core/ports/mail";
import { createMemoryRateLimiter, withFallback, type RateLimiter, type RateLimitRule } from "@/core/security/rate-limit";
import { createDb, type Db } from "@/db/client";
import { createEmailModule, type EmailProvider } from "@/modules/email";
import { consoleEmailProvider } from "@/providers/email/console";
import { resendProvider } from "@/providers/email/resend";
import { upstashRateLimiter } from "@/providers/rate-limit/upstash";
import { createProduct, type Product } from "@/product/manifest";
import { appConfig } from "@/config/app";
import { authConfig } from "@/config/auth";
import { features } from "@/config/features";
import { getEnv, type Env } from "./env";

/** Services available only in profile "app". */
export interface AppServices {
  db: Db;
  auth: AuthService;
  account: AccountService;
  product: Product["services"];
}

/** Services wired for the running project. */
export interface Container {
  features: Features;
  logger: Logger;
  mail: MailPort;
  /** Only present when the email module is enabled. */
  contact?: ContactService;
  /** Only present in profile "app". */
  app?: AppServices;
}

export interface ContainerOverrides {
  rateLimiter?: RateLimiter;
  authRateLimits?: AuthRateLimits;
  mail?: MailPort;
  db?: Db;
}

const CONTACT_LIMIT: RateLimitRule = { max: 5, windowMs: 10 * 60_000 };
const MAGIC_LINK_PER_CLIENT: RateLimitRule = { max: 5, windowMs: 10 * 60_000 };
const MAGIC_LINK_PER_RECIPIENT: RateLimitRule = { max: 3, windowMs: 10 * 60_000 };

let cached: Container | undefined;

/** Lazy: nothing is validated or constructed until the first call. */
export function getContainer(): Container {
  return (cached ??= buildContainer(features, getEnv()));
}

export function buildContainer(features: Features, env: Env, overrides: ContainerOverrides = {}): Container {
  const logger = createLogger({ level: env.LOG_LEVEL });

  const mail: MailPort =
    overrides.mail ??
    (features.email
      ? createEmailModule({ provider: emailProvider(env, logger), from: env.extra.EMAIL_FROM!, logger }).asMailPort()
      : noopMail);

  const contact = features.email
    ? createContactService({
        mail,
        rateLimiter: overrides.rateLimiter ?? rateLimiterFor(env, CONTACT_LIMIT, logger),
        to: env.extra.CONTACT_TO_EMAIL!,
        logger,
      })
    : undefined;

  const app = features.profile === "app" ? buildApp(env, mail, logger, overrides) : undefined;

  return { features, logger, mail, contact, app };
}

function buildApp(env: Env, mail: MailPort, logger: Logger, overrides: ContainerOverrides): AppServices {
  const db = overrides.db ?? createDb(env.extra.DATABASE_URL!).db;
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined;

  const auth = createAuthService(
    createBetterAuth({
      appName: appConfig.name,
      db,
      mail,
      secret: env.extra.BETTER_AUTH_SECRET!,
      baseURL: env.NEXT_PUBLIC_SITE_URL,
      methods: authConfig.methods,
      trustedProviders: authConfig.trustedProviders,
      google,
      disableRateLimit: env.NODE_ENV === "test",
    }),
    { magicLink: authConfig.methods.magicLink, google: authConfig.methods.google && Boolean(google) },
    overrides.authRateLimits ?? {
      perClient: rateLimiterFor(env, MAGIC_LINK_PER_CLIENT, logger),
      perRecipient: rateLimiterFor(env, MAGIC_LINK_PER_RECIPIENT, logger),
    },
  );
  const product = createProduct(db);
  return { db, auth, account: createAccountService(db, product.exporters), product: product.services };
}

function emailProvider(env: Env, logger: Logger): EmailProvider {
  return env.EMAIL_PROVIDER === "console" ? consoleEmailProvider(logger) : resendProvider({ apiKey: env.EMAIL_API_KEY! });
}

/** Upstash when configured (falling back to memory if it fails), otherwise in-memory. */
function rateLimiterFor(env: Env, rule: RateLimitRule, logger: Logger): RateLimiter {
  const memory = createMemoryRateLimiter(rule);
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return memory;
  const upstash = upstashRateLimiter({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }, rule);
  return withFallback(upstash, memory, (error) => logger.warn("ratelimit.store_failed", { error }));
}
