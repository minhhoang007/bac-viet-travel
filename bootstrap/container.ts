import { createContactService, type ContactService } from "@/core/contact";
import { createLogger, type Logger } from "@/core/logger";
import type { Features } from "@/core/module";
import { noopMail, type MailPort } from "@/core/ports/mail";
import { createMemoryRateLimiter, type RateLimiter, type RateLimitRule } from "@/core/security/rate-limit";
import { createEmailModule } from "@/modules/email";
import { resendProvider } from "@/providers/email/resend";
import { upstashRateLimiter } from "@/providers/rate-limit/upstash";
import { features } from "@/config/features";
import { getEnv, type Env } from "./env";

/** Services wired for the running project. */
export interface Container {
  features: Features;
  logger: Logger;
  mail: MailPort;
  /** Only present when the email module is enabled. */
  contact?: ContactService;
}

const CONTACT_LIMIT: RateLimitRule = { max: 5, windowMs: 10 * 60_000 };

let cached: Container | undefined;

/** Lazy: nothing is validated or constructed until the first call. */
export function getContainer(): Container {
  return (cached ??= buildContainer(features, getEnv()));
}

export function buildContainer(features: Features, env: Env, overrides: { rateLimiter?: RateLimiter } = {}): Container {
  const logger = createLogger({ level: env.LOG_LEVEL });

  const mail: MailPort = features.email
    ? createEmailModule({
        provider: resendProvider({ apiKey: env.extra.EMAIL_API_KEY! }),
        from: env.extra.EMAIL_FROM!,
        logger,
      }).asMailPort()
    : noopMail;

  const contact = features.email
    ? createContactService({
        mail,
        rateLimiter: overrides.rateLimiter ?? rateLimiterFor(env, CONTACT_LIMIT),
        to: env.extra.CONTACT_TO_EMAIL!,
        logger,
      })
    : undefined;

  return { features, logger, mail, contact };
}

function rateLimiterFor(env: Env, rule: RateLimitRule): RateLimiter {
  return env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? upstashRateLimiter({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }, rule)
    : createMemoryRateLimiter(rule);
}
