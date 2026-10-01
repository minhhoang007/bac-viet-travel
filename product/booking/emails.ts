import type { MailMessage } from "@/core/ports/mail";
import type { Booking, Departure } from "../schema/booking";
import { formatDay, formatVnd } from "./content";

/** Plain-text emails after a deposit IPN (the email module adds the HTML version). Guest language = booking locale. */
export function depositEmails(input: {
  booking: Booking;
  departure: Departure;
  title: string;
  siteUrl: string;
  /** Guest link token; null when unknown (the email then gives the booking code only). */
  token: string | null;
  outcome: "paid" | "refund_due";
  teamEmail?: string;
}): MailMessage[] {
  const { booking: b, departure: d, title, outcome } = input;
  const locale = b.locale === "en" ? "en" : "vi";
  const prefix = locale === "en" ? "/en" : "";
  const link = input.token ? `${input.siteUrl}${prefix}/booking/${b.code}?t=${input.token}` : null;
  const day = formatDay(d.date, locale);
  const guests = b.adults + b.children + b.infants;
  const rest = formatVnd(b.totalVnd - b.depositVnd, locale);

  const guest: MailMessage =
    locale === "vi"
      ? outcome === "paid"
        ? {
            kind: "booking_deposit_paid",
            to: b.email,
            subject: `Đã nhận đặt cọc – ${title} (${b.code})`,
            text: [
              `Chào ${b.name},`,
              ``,
              `Bắc Việt Travel đã nhận tiền đặt cọc ${formatVnd(b.depositVnd, locale)} cho đơn ${b.code}.`,
              ``,
              `Tour: ${title}`,
              `Ngày khởi hành: ${day}`,
              `Số khách: ${guests}`,
              `Tổng tiền: ${formatVnd(b.totalVnd, locale)} – còn lại ${rest}, thanh toán trước ngày đi.`,
              ``,
              link ? `Xem đơn của bạn: ${link}` : `Mã đơn của bạn: ${b.code}`,
              ``,
              `Chúng tôi sẽ liên hệ xác nhận điểm đón trước ngày đi.`,
            ].join("\n"),
          }
        : {
            kind: "booking_refund_due",
            to: b.email,
            subject: `Đơn ${b.code}: chúng tôi sẽ hoàn tiền đặt cọc`,
            text: [
              `Chào ${b.name},`,
              ``,
              `Chúng tôi đã nhận ${formatVnd(b.depositVnd, locale)} cho đơn ${b.code}, nhưng thời gian giữ chỗ đã hết và ngày ${day} không còn đủ chỗ.`,
              `Bắc Việt Travel sẽ hoàn lại toàn bộ số tiền này, hoặc liên hệ để chuyển sang ngày khác nếu bạn muốn.`,
            ].join("\n"),
          }
      : outcome === "paid"
        ? {
            kind: "booking_deposit_paid",
            to: b.email,
            subject: `Deposit received – ${title} (${b.code})`,
            text: [
              `Hello ${b.name},`,
              ``,
              `We have received your deposit of ${formatVnd(b.depositVnd, locale)} for booking ${b.code}.`,
              ``,
              `Tour: ${title}`,
              `Departure: ${day}`,
              `Guests: ${guests}`,
              `Total: ${formatVnd(b.totalVnd, locale)} – balance ${rest}, payable before departure.`,
              ``,
              link ? `View your booking: ${link}` : `Your booking code: ${b.code}`,
              ``,
              `We will contact you to confirm the pick-up point before departure.`,
            ].join("\n"),
          }
        : {
            kind: "booking_refund_due",
            to: b.email,
            subject: `Booking ${b.code}: your deposit will be refunded`,
            text: [
              `Hello ${b.name},`,
              ``,
              `We received ${formatVnd(b.depositVnd, locale)} for booking ${b.code}, but your hold had expired and ${day} no longer has enough seats.`,
              `We will refund the full amount, or contact you to move to another date if you prefer.`,
            ].join("\n"),
          };

  const messages = [guest];
  if (input.teamEmail) {
    messages.push({
      kind: outcome === "paid" ? "booking_team_paid" : "booking_team_refund",
      to: input.teamEmail,
      replyTo: b.email,
      subject: outcome === "paid" ? `[Đặt cọc] ${b.code} – ${title} – ${d.date}` : `[CẦN HOÀN TIỀN] ${b.code} – ${title} – ${d.date}`,
      text: [
        outcome === "paid" ? `Đơn mới đã đặt cọc.` : `Tiền cọc về sau khi hết giữ chỗ và không còn đủ chỗ: cần hoàn tiền hoặc đổi ngày.`,
        ``,
        `Mã đơn: ${b.code}`,
        `Tour: ${title} – ${d.date}`,
        `Khách: ${b.name} · ${b.email} · ${b.phone}`,
        `Người lớn ${b.adults}, trẻ em ${b.children}, em bé ${b.infants}`,
        `Đặt cọc: ${formatVnd(b.depositVnd, "vi")} / Tổng: ${formatVnd(b.totalVnd, "vi")}`,
        b.note ? `Ghi chú: ${b.note}` : ``,
      ].join("\n"),
    });
  }
  return messages;
}
