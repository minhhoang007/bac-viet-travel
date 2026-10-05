import { sql } from "drizzle-orm";
import { createAccountService, type AccountService } from "@/core/account";
import { createAuthService, type AuthRateLimits, type AuthService } from "@/core/auth";
import { createBetterAuth } from "@/core/auth/adapters/better-auth";
import { createContactService, type ContactService } from "@/core/contact";
import { createLogger, type Logger } from "@/core/logger";
import type { Features } from "@/core/module";
import { noopMail, type MailMessage, type MailPort } from "@/core/ports/mail";
import { createVnpayIpn, type VnpayIpnHandler, type VnpayIpnResult } from "@/core/payments/vnpay-ipn";
import type { Payments } from "@/core/ports/payments";
import type { ProductContext, ProductJobs } from "@/core/product/context";
import { createMemoryRateLimiter, withFallback, type RateLimiter, type RateLimitRule } from "@/core/security/rate-limit";
import { createDb, type Db } from "@/db/client";
import { createAdminModule, type AdminModule } from "@/modules/admin";
import { createAnalyticsModule, type AnalyticsModule } from "@/modules/analytics";
import { createBillingModule, PROCESS_WEBHOOK_JOB, type BillingModule, type OneTimePaymentProvider, type SubscriptionProvider } from "@/modules/billing";
import { createEmailModule, SEND_EMAIL_JOB, type EmailProvider } from "@/modules/email";
import { createEntitlementsModule, type EntitlementsModule } from "@/modules/entitlements";
import { createJobsModule, type JobHandler, type JobsModule } from "@/modules/jobs";
import { createStorageModule, type ObjectStorage, type StorageModule } from "@/modules/storage";
import { polarProvider } from "@/providers/billing/polar";
import { VNPAY_SANDBOX_URL, vnpayProvider } from "@/providers/billing/vnpay";
import { consoleEmailProvider } from "@/providers/email/console";
import { resendProvider } from "@/providers/email/resend";
import { upstashRateLimiter } from "@/providers/rate-limit/upstash";
import { s3Storage } from "@/providers/storage/s3";
import { createProduct, type Product } from "@/product/manifest";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { authConfig } from "@/config/auth";
import { billingConfig } from "@/config/billing";
import { features } from "@/config/features";
import { storageConfig } from "@/config/storage";
import { getEnv, type Env } from "./env";

/** Services available only in profile "app". */
export interface AppServices {
  db: Db;
  auth: AuthService;
  account: AccountService;
  product: Product["services"];
  /** The product's VNPay IPN handler (manifest `vnpayIpn`), tried before billing. */
  vnpayIpn?: VnpayIpnHandler;
}

/** Services wired for the running project. Optional members exist only when their module/profile is on. */
export interface Container {
  features: Features;
  /** Liveness of dependencies for /api/health (no details that could leak configuration). */
  health(): Promise<{ db: "ok" | "error" | "skipped" }>;
  /**
   * Shared rate limiter for project features (e.g. a booking form): Upstash when configured, else in-memory.
   * Memoized per name, so call it on every request and get the same limiter.
   */
  rateLimiter(name: string, rule: RateLimitRule): RateLimiter;
  /** One-time payment providers configured by env (independent of the billing module). */
  payments: Payments;
  /**
   * The VNPay IPN endpoint, present when VNPay is configured: verifies the signature once, then offers the order to
   * the product, then to billing (one IPN URL per merchant code).
   */
  handleVnpayIpn?: (params: Record<string, string>) => Promise<VnpayIpnResult>;
  logger: Logger;
  mail: MailPort;
  contact?: ContactService;
  app?: AppServices;
  jobs?: JobsModule;
  entitlements?: EntitlementsModule;
  billing?: BillingModule;
  admin?: AdminModule;
  analytics?: AnalyticsModule;
  storage?: StorageModule;
}

export interface ContainerOverrides {
  rateLimiter?: RateLimiter;
  authRateLimits?: AuthRateLimits;
  mail?: MailPort;
  emailProvider?: EmailProvider;
  db?: Db;
  billingProviders?: { polar?: SubscriptionProvider; vnpay?: OneTimePaymentProvider };
  now?: () => Date;
  objectStorage?: ObjectStorage;
}

const CONTACT_LIMIT: RateLimitRule = { max: 5, windowMs: 10 * 60_000 };
const MAGIC_LINK_PER_CLIENT: RateLimitRule = { max: 5, windowMs: 10 * 60_000 };
const MAGIC_LINK_PER_RECIPIENT: RateLimitRule = { max: 3, windowMs: 10 * 60_000 };
const CHECKOUT_LIMIT: RateLimitRule = { max: 10, windowMs: 10 * 60_000 };

let cached: Container | undefined;

/** Lazy: nothing is validated or constructed until the first call. */
export function getContainer(): Container {
  return (cached ??= buildContainer(features, getEnv()));
}

export function buildContainer(features: Features, env: Env, overrides: ContainerOverrides = {}): Container {
  const logger = createLogger({ level: env.LOG_LEVEL });
  // Profile "site" has a database only for analytics events.
  const needsDb = features.profile === "app" || features.analytics;
  const db = needsDb ? (overrides.db ?? createDb(env.extra.DATABASE_URL!).db) : undefined;

  // Jobs: handlers/periodic tasks are registered below by the modules that own them.
  const handlers: Record<string, JobHandler> = {};
  const periodic: Record<string, () => Promise<void>> = {};
  const jobs = features.jobs && db ? createJobsModule({ db, logger, handlers, periodic }) : undefined;

  const email = features.email
    ? createEmailModule({
        provider: overrides.emailProvider ?? emailProvider(env, logger),
        from: env.extra.EMAIL_FROM!,
        logger,
        scheduleRetry: jobs ? (message) => jobs.enqueue(SEND_EMAIL_JOB, { message }, { maxAttempts: 6 }) : undefined,
        html: { brand: appConfig.name, accent: brand.colors.light.primary },
      })
    : undefined;
  if (email && jobs) handlers[SEND_EMAIL_JOB] = (payload) => email.sendNow(payload.message as MailMessage);

  const mail: MailPort = overrides.mail ?? email?.asMailPort() ?? noopMail;

  const contact = features.email
    ? createContactService({
        mail,
        rateLimiter: overrides.rateLimiter ?? rateLimiterFor(env, CONTACT_LIMIT, logger),
        to: env.extra.CONTACT_TO_EMAIL!,
        logger,
      })
    : undefined;

  const payments = buildPayments(env, overrides);

  const limiters = new Map<string, RateLimiter>();
  const rateLimiter = (name: string, rule: RateLimitRule) => {
    let limiter = limiters.get(name);
    if (!limiter) limiters.set(name, (limiter = overrides.rateLimiter ?? rateLimiterFor(env, rule, logger)));
    return limiter;
  };

  const entitlements = features.entitlements && db ? createEntitlementsModule(db, billingConfig.plans, overrides.now) : undefined;

  const billing =
    features.billing && db && jobs && entitlements
      ? buildBilling(env, { db, logger, jobs, entitlements, overrides, vnpay: payments.vnpay, checkoutLimiter: rateLimiter("billing:checkout", CHECKOUT_LIMIT) })
      : undefined;
  if (billing) {
    handlers[PROCESS_WEBHOOK_JOB] = (payload) => billing.processWebhookEvent(String(payload.eventRowId));
    periodic["billing.sweep_webhooks"] = async () => void (await billing.sweepWebhookEvents());
    periodic["billing.reconcile"] = async () => void (await billing.reconcileSubscriptions());
    periodic["billing.purge_orders"] = async () => void (await billing.purgeStaleOrders());
  }

  const analytics = features.analytics && db ? createAnalyticsModule({ db, secret: env.extra.ANALYTICS_SECRET!, purgeOnCollect: !jobs, now: overrides.now }) : undefined;
  if (analytics) periodic["analytics.purge"] = async () => void (await analytics.purge());

  const storage =
    features.storage && db
      ? createStorageModule({
          db,
          logger,
          objects:
            overrides.objectStorage ??
            s3Storage({
              endpoint: env.extra.STORAGE_ENDPOINT!,
              bucket: env.extra.STORAGE_BUCKET!,
              accessKeyId: env.extra.STORAGE_ACCESS_KEY_ID!,
              secretAccessKey: env.extra.STORAGE_SECRET_ACCESS_KEY!,
              region: env.STORAGE_REGION,
            }),
          config: storageConfig,
          quotaFor: entitlements
            ? (userId) => entitlements.getLimit(userId, "storage.max_bytes")
            : async () => billingConfig.plans.free.entitlements["storage.max_bytes"],
        })
      : undefined;
  if (storage) periodic["storage.purge_pending"] = async () => void (await storage.purgePending());

  const admin = features.admin && db ? createAdminModule({ db, logger }) : undefined;

  const productContext: ProductContext | undefined = db
    ? { db, logger, mail, rateLimiter, payments, jobs, audit: admin, now: overrides.now ?? (() => new Date()) }
    : undefined;
  const app =
    features.profile === "app" && productContext
      ? buildApp(env, mail, logger, overrides, productContext, { billing, analytics, storage, handlers: jobs ? handlers : undefined, periodic })
      : undefined;


  const health = async () => {
    if (!db) return { db: "skipped" as const };
    try {
      await db.execute(sql`select 1`);
      return { db: "ok" as const };
    } catch (error) {
      logger.error("health.db_failed", { error });
      return { db: "error" as const };
    }
  };

  const vnpayIpnHandlers = [app?.vnpayIpn, billing?.providers.includes("vnpay") ? billing.vnpayIpnHandler : undefined].filter((h) => h !== undefined);
  const vnpay = payments.vnpay;
  const handleVnpayIpn = vnpay ? createVnpayIpn({ verify: (p) => vnpay.verify(p), handlers: vnpayIpnHandlers, logger }) : undefined;

  return { features, logger, mail, health, rateLimiter, payments, handleVnpayIpn, contact, app, jobs, entitlements, billing, admin, analytics, storage };
}

function buildBilling(
  env: Env,
  ctx: { db: Db; logger: Logger; jobs: JobsModule; entitlements: EntitlementsModule; overrides: ContainerOverrides; vnpay?: OneTimePaymentProvider; checkoutLimiter: RateLimiter },
): BillingModule {
  const enabled = billingConfig.providers;
  const polar = enabled.includes("polar")
    ? (ctx.overrides.billingProviders?.polar ??
      polarProvider({ accessToken: env.POLAR_ACCESS_TOKEN!, webhookSecret: env.POLAR_WEBHOOK_SECRET!, server: env.POLAR_SERVER }))
    : undefined;
  const vnpay = enabled.includes("vnpay") ? ctx.vnpay : undefined;

  return createBillingModule({
    db: ctx.db,
    logger: ctx.logger,
    jobs: ctx.jobs,
    entitlements: ctx.entitlements,
    plans: billingConfig.plans,
    periodDays: billingConfig.periodDays,
    providers: enabled,
    polar: polar && {
      ...polar,
      products: { pro: { month: env.POLAR_PRODUCT_PRO_MONTHLY ?? "", year: env.POLAR_PRODUCT_PRO_YEARLY ?? "" } },
    },
    vnpay,
    checkoutLimiter: ctx.checkoutLimiter,
    now: ctx.overrides.now,
  });
}

/** VNPay is configured by env alone, so product code can take one-time payments without the billing module. */
function buildPayments(env: Env, overrides: ContainerOverrides): Payments {
  const sandbox = (env.VNPAY_PAYMENT_URL ?? VNPAY_SANDBOX_URL) === VNPAY_SANDBOX_URL;
  const vnpay =
    overrides.billingProviders?.vnpay ??
    (env.VNPAY_TMN_CODE && env.VNPAY_HASH_SECRET
      ? vnpayProvider({ tmnCode: env.VNPAY_TMN_CODE, hashSecret: env.VNPAY_HASH_SECRET, paymentUrl: env.VNPAY_PAYMENT_URL })
      : undefined);
  return vnpay ? { vnpay: { ...vnpay, sandbox } } : {};
}

// Projects created before rc.10 declare createProduct(db): calling it with the extra context is harmless.
const createProductWith: (db: Db, ctx: ProductContext) => Product & { jobs?: ProductJobs; vnpayIpn?: VnpayIpnHandler } = createProduct;

function buildApp(
  env: Env,
  mail: MailPort,
  logger: Logger,
  overrides: ContainerOverrides,
  ctx: ProductContext,
  {
    billing,
    analytics,
    storage,
    handlers,
    periodic,
  }: {
    billing?: BillingModule;
    analytics?: AnalyticsModule;
    storage?: StorageModule;
    handlers?: Record<string, JobHandler>;
    periodic: Record<string, () => Promise<void>>;
  },
): AppServices {
  const { db } = ctx;
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
  const product = createProductWith(db, ctx);
  if (product.jobs) {
    if (!handlers) logger.warn("product.jobs_ignored", { reason: "jobs module is off" });
    else {
      Object.assign(handlers, product.jobs.handlers);
      for (const [name, task] of Object.entries(product.jobs.periodic ?? {})) periodic[`product.${name}`] = task;
    }
  }
  const account = createAccountService(
    db,
    [
      ...product.exporters,
      ...(billing ? [{ name: "billing", export: (userId: string) => billing.exportForUser(userId) }] : []),
      ...(storage ? [{ name: "files", export: (userId: string) => storage.exportForUser(userId) }] : []),
      ...(analytics ? [{ name: "analytics", export: (userId: string) => analytics.exportForUser(userId) }] : []),
    ],
    [
      // Never delete an account that would keep being charged.
      ...(billing ? [async (userId: string) => void (await billing.revokeSubscriptionsForUser(userId))] : []),
      // Objects first: a failed storage delete aborts the deletion instead of leaving orphaned files.
      ...(storage ? [async (userId: string) => void (await storage.deleteAllForUser(userId))] : []),
    ],
  );
  return { db, auth, account, product: product.services, vnpayIpn: product.vnpayIpn };
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
