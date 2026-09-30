import type { Logger } from "@/core/logger";
import type { EmailProvider } from "@/modules/email";

/** Development/test only: prints emails instead of sending (blocked in production by env validation). */
export function consoleEmailProvider(logger: Logger): EmailProvider {
  return {
    async send(message) {
      const id = `console-${crypto.randomUUID()}`;
      logger.info("email.console", { id, to: message.to, subject: message.subject, text: message.text });
      return { id };
    },
  };
}
