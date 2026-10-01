import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import type { MailMessage, MailPort } from "@/core/ports/mail";
import { textToHtml } from "./html";
import type { EmailProvider } from "./ports";

export const SEND_EMAIL_JOB = "email.send";

export interface EmailModuleDeps {
  provider: EmailProvider;
  from: string;
  logger: Logger;
  /**
   * When the jobs module is on: schedule a retry instead of failing the caller.
   * Direct send stays the fast path, so magic links are not delayed by the job scheduler.
   */
  scheduleRetry?: (message: MailMessage) => Promise<void>;
  /** Brand for the generated HTML version of plain-text emails. */
  html?: { brand: string; accent?: string };
}

export interface EmailModule {
  /** Direct send; on provider failure schedules a retry (if configured), otherwise throws. */
  send(message: MailMessage): Promise<void>;
  /** Job handler: send once and throw on failure so the job retries with backoff. */
  sendNow(message: MailMessage): Promise<void>;
  asMailPort(): MailPort;
}

export function createEmailModule({ provider, from, logger, scheduleRetry, html }: EmailModuleDeps): EmailModule {
  const sendNow = async (message: MailMessage) => {
    const withHtml = html && !message.html ? { ...message, html: textToHtml(message.text, html) } : message;
    const { id } = await provider.send({ ...withHtml, from });
    // Only id + kind: subject/body/recipient may contain personal data.
    logger.info("email.sent", { id, kind: message.kind });
  };

  const send = async (message: MailMessage) => {
    try {
      await sendNow(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      if (scheduleRetry) {
        await scheduleRetry(message);
        logger.warn("email.retry_scheduled", { kind: message.kind, error: reason });
        return;
      }
      logger.error("email.failed", { kind: message.kind, error: reason });
      throw new AppError("INTERNAL_ERROR", "Email delivery failed", { cause: error });
    }
  };

  return { send, sendNow, asMailPort: () => ({ send }) };
}
