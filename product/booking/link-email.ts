import type { MailMessage } from "@/core/ports/mail";
import type { Booking } from "../schema/booking";

// Its own file: the guest booking service sends it, and emails.ts depends on content.ts, which imports service types.

/** A new private link the guest asked for (the previous one no longer works). */
export function bookingLinkEmail(input: { booking: Pick<Booking, "code" | "name" | "email" | "locale">; siteUrl: string; token: string }): MailMessage {
  const { booking: b, siteUrl, token } = input;
  const vi = b.locale !== "en";
  const link = `${siteUrl}${vi ? "" : "/en"}/booking/${b.code}?t=${token}`;
  return {
    kind: "booking_link",
    to: b.email,
    subject: vi ? `Đường link xem đơn ${b.code}` : `Your booking link (${b.code})`,
    text: vi
      ? [`Chào ${b.name},`, ``, `Đây là đường link mới để xem đơn ${b.code}:`, link, ``, `Đường link cũ không còn dùng được. Nếu bạn không yêu cầu, hãy bỏ qua email này hoặc nhắn Zalo cho chúng tôi.`].join("\n")
      : [`Hello ${b.name},`, ``, `Here is your new link to booking ${b.code}:`, link, ``, `The previous link no longer works. If you did not ask for this, ignore this email or message us on WhatsApp.`].join("\n"),
  };
}
