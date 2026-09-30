import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import type { MailMessage, MailPort } from "@/core/ports/mail";
import type { EmailProvider } from "./ports";

export interface EmailModuleDeps {
  provider: EmailProvider;
  from: string;
  logger: Logger;
}

export interface EmailModule {
  send(message: MailMessage): Promise<void>;
  asMailPort(): MailPort;
}

/** Direct send, no retry (V0.1). Retry through jobs arrives with the jobs module. */
export function createEmailModule({ provider, from, logger }: EmailModuleDeps): EmailModule {
  const send = async (message: MailMessage) => {
    try {
      const { id } = await provider.send({ ...message, from });
      logger.info("email.sent", { id, subject: message.subject });
    } catch (error) {
      logger.error("email.failed", { error, subject: message.subject });
      throw new AppError("INTERNAL_ERROR", "Email delivery failed", { cause: error });
    }
  };
  return { send, asMailPort: () => ({ send }) };
}
