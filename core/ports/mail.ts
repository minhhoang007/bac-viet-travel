import { AppError } from "@/core/errors";

export interface MailMessage {
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
