import type { EmailProvider } from "@/modules/email";

/** Resend REST adapter (no SDK needed). https://resend.com/docs/api-reference/emails/send-email */
export function resendProvider(options: { apiKey: string; fetch?: typeof fetch }): EmailProvider {
  const doFetch = options.fetch ?? fetch;
  return {
    async send(message) {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { id: body.id ?? "unknown" };
    },
  };
}
