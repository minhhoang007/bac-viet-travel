import type { MailMessage } from "@/core/ports/mail";

/** Implemented by vendor adapters in providers/email/. */
export interface EmailProvider {
  send(message: MailMessage & { from: string }): Promise<{ id: string }>;
}
