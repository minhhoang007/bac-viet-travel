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
      // Only id + kind: subject/body/recipient may contain personal data.
      logger.info("email.sent", { id, kind: message.kind });
    } catch (error) {
      logger.error("email.failed", { kind: message.kind, error: error instanceof Error ? error.message : "unknown" });
      throw new AppError("INTERNAL_ERROR", "Email delivery failed", { cause: error });
    }
  };
  return { send, asMailPort: () => ({ send }) };
}
