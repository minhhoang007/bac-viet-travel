import { AppError } from "@/core/errors";

export interface MailMessage {
  /** Category for logs/metrics (e.g. "contact", "magic_link"). Logs never contain subject, body or recipient. */
  kind: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/** What Core needs from an email implementation. Wired in bootstrap/ (email module or noop). */
export interface MailPort {
  send(message: MailMessage): Promise<void>;
}

export const noopMail: MailPort = {
  async send() {
    throw new AppError("MODULE_DISABLED", 'Module "email" is disabled');
  },
};
