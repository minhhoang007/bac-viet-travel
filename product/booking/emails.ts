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
  /** refund_due: seats gone when late money arrived. extra: the booking no longer waited for a deposit (paid twice). */
  outcome: "paid" | "refund_due" | "extra";
  /** The amount that arrived (for "extra"). */
  amountVnd?: number;
  teamEmail?: string;
}): MailMessage[] {
  const { booking: b, departure: d, title, outcome } = input;
  const locale = b.locale === "en" ? "en" : "vi";
  const prefix = locale === "en" ? "/en" : "";
  const link = input.token ? `${input.siteUrl}${prefix}/booking/${b.code}?t=${input.token}` : null;
  const day = formatDay(d.date, locale);
  const guests = b.adults + b.children + b.infants;
  const rest = formatVnd(b.totalVnd - b.depositVnd, locale);
  const received = formatVnd(input.amountVnd ?? b.depositVnd, locale);

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

  const extra: MailMessage =
    locale === "vi"
      ? {
          kind: "booking_refund_due",
          to: b.email,
          subject: `Đơn ${b.code}: chúng tôi sẽ hoàn khoản thanh toán thừa`,
          text: [
            `Chào ${b.name},`,
            ``,
            `Chúng tôi đã nhận thêm ${received} cho đơn ${b.code}, trong khi đơn này không còn chờ đặt cọc (đã cọc trước đó hoặc đã huỷ).`,
            `Bắc Việt Travel sẽ hoàn lại khoản này và liên hệ với bạn.`,
          ].join("\n"),
        }
      : {
          kind: "booking_refund_due",
          to: b.email,
          subject: `Booking ${b.code}: we will refund an extra payment`,
          text: [
            `Hello ${b.name},`,
            ``,
            `We received another ${received} for booking ${b.code}, which was no longer waiting for a deposit (already paid, or cancelled).`,
            `We will refund this amount and contact you.`,
          ].join("\n"),
        };

  const messages = [outcome === "extra" ? extra : guest];
  if (input.teamEmail) {
    messages.push({
      kind: outcome === "paid" ? "booking_team_paid" : "booking_team_refund",
      to: input.teamEmail,
      replyTo: b.email,
      subject: outcome === "paid" ? `[Đặt cọc] ${b.code} – ${title} – ${d.date}` : `[CẦN HOÀN TIỀN] ${b.code} – ${title} – ${d.date}`,
      text: [
        outcome === "paid"
          ? `Đơn mới đã đặt cọc.`
          : outcome === "extra"
            ? `Khách trả thêm ${formatVnd(input.amountVnd ?? 0, "vi")} cho đơn không còn chờ cọc (trả hai lần hoặc đã huỷ): cần hoàn khoản này.`
            : `Tiền cọc về sau khi hết giữ chỗ và không còn đủ chỗ: cần hoàn tiền hoặc đổi ngày.`,
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

/** Guest email when staff confirm or cancel a booking. */
export function bookingStatusEmail(input: { booking: Booking; departure: Departure; title: string; kind: "confirmed" | "cancelled" }): MailMessage {
  const { booking: b, departure: d, title, kind } = input;
  const vi = b.locale !== "en";
  const day = formatDay(d.date, vi ? "vi" : "en");
  const refund = b.refundDueVnd > 0 && !b.refundedAt ? formatVnd(b.refundDueVnd, vi ? "vi" : "en") : null;
  if (kind === "confirmed") {
    return {
      kind: "booking_confirmed",
      to: b.email,
      subject: vi ? `Đơn ${b.code} đã được xác nhận – ${title}` : `Booking ${b.code} confirmed – ${title}`,
      text: vi
        ? [`Chào ${b.name},`, ``, `Bắc Việt Travel xác nhận đơn ${b.code}: ${title}, khởi hành ${day}.`, `Số tiền còn lại: ${formatVnd(b.totalVnd - b.depositVnd, "vi")}, thanh toán trước ngày đi.`, `Chúng tôi sẽ gửi giờ và điểm đón trước chuyến đi.`].join("\n")
        : [`Hello ${b.name},`, ``, `Your booking ${b.code} is confirmed: ${title}, departing ${day}.`, `Balance due: ${formatVnd(b.totalVnd - b.depositVnd, "en")}, payable before departure.`, `We will send pick-up details before the trip.`].join("\n"),
    };
  }
  return {
    kind: "booking_cancelled",
    to: b.email,
    subject: vi ? `Đơn ${b.code} đã bị huỷ` : `Booking ${b.code} cancelled`,
    text: vi
      ? [`Chào ${b.name},`, ``, `Đơn ${b.code} (${title}, ${day}) đã được huỷ.`, `Lý do: ${b.cancelReason ?? ""}`, refund ? `Chúng tôi sẽ hoàn lại ${refund} cho bạn.` : ``, `Mọi thắc mắc vui lòng liên hệ Zalo / hotline.`].join("\n")
      : [`Hello ${b.name},`, ``, `Booking ${b.code} (${title}, ${day}) has been cancelled.`, `Reason: ${b.cancelReason ?? ""}`, refund ? `We will refund ${refund} to you.` : ``, `Questions? Contact us on WhatsApp.`].join("\n"),
  };
}

/** Reminder a few days before departure. */
export function reminderEmail(input: { booking: Booking; departure: Departure; title: string }): MailMessage {
  const { booking: b, departure: d, title } = input;
  const vi = b.locale !== "en";
  const day = formatDay(d.date, vi ? "vi" : "en");
  const rest = formatVnd(b.totalVnd - b.depositVnd, vi ? "vi" : "en");
  return {
    kind: "booking_reminder",
    to: b.email,
    subject: vi ? `Sắp khởi hành: ${title} (${day})` : `Coming up: ${title} (${day})`,
    text: vi
      ? [`Chào ${b.name},`, ``, `Chuyến ${title} của bạn khởi hành ${day} (đơn ${b.code}, ${b.seats} khách).`, `Xe đón tại khách sạn khu Phố Cổ Hà Nội từ 7:30–8:00. Hướng dẫn viên sẽ gọi xác nhận trước 1 ngày.`, `Số tiền còn lại: ${rest}.`, `Mang theo: giấy tờ tuỳ thân, giày thoải mái, áo khoác mỏng.`].join("\n")
      : [`Hello ${b.name},`, ``, `Your trip ${title} departs ${day} (booking ${b.code}, ${b.seats} guests).`, `Hotel pick-up in Hanoi Old Quarter from 7:30–8:00. Your guide will call to confirm the day before.`, `Balance due: ${rest}.`, `Bring: ID/passport, comfortable shoes, a light jacket.`].join("\n"),
  };
}
