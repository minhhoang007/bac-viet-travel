import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import type { RateLimiter } from "@/core/security/rate-limit";
import { contactSchema, type ContactFieldError, type ContactInput } from "./schema";

export type ContactResult =
  | { status: "success" }
  | { status: "invalid"; fieldErrors: Partial<Record<keyof ContactInput, ContactFieldError>> }
  | { status: "rate_limited" }
  | { status: "error" };

export interface ContactService {
  submit(raw: Record<string, unknown>, clientKey: string): Promise<ContactResult>;
}

export function createContactService(deps: {
  mail: MailPort;
  rateLimiter: RateLimiter;
  to: string;
  logger: Logger;
}): ContactService {
  return {
    async submit(raw, clientKey) {
      const parsed = contactSchema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Partial<Record<keyof ContactInput, ContactFieldError>> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as keyof ContactInput;
          if (field === "website") {
            // Bot filled the honeypot: pretend success, send nothing. (No IP in logs: personal data.)
            deps.logger.warn("contact.honeypot");
            return { status: "success" };
          }
          const code = (["required", "invalid_email", "too_long"] as const).find((c) => c === issue.message);
          fieldErrors[field] ??= code ?? "required";
        }
        return { status: "invalid", fieldErrors };
      }

      const { success } = await deps.rateLimiter.limit(`contact:${clientKey}`);
      if (!success) return { status: "rate_limited" };

      const { name, email, message } = parsed.data;
      try {
        await deps.mail.send({
          to: deps.to,
          replyTo: email,
          // Control characters stripped so user input can never add header lines.
          subject: `Contact form: ${name.replace(/[\p{Cc}\p{Cf}]+/gu, " ").trim()}`,
          text: `From: ${name} <${email}>\n\n${message}`,
        });
        return { status: "success" };
      } catch (error) {
        deps.logger.error("contact.send_failed", { error });
        return { status: "error" };
      }
    },
  };
}
