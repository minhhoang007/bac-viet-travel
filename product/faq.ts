import type { Locale } from "@/config/app";
import { bankTransferConfig } from "@/config/bank-transfer";
import { bookingRules } from "./booking/rules";

// Project-owned: questions guests ask before booking (E5). Facts come from the booking rules and config, so the
// answers follow them; terms the owner has not fixed yet (cancellation) link to the policy pages instead.

export interface FaqItem {
  q: string;
  a: string;
  /** Optional link under the answer (site path). */
  link?: { href: string; label: string };
}
export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

const deposit = Math.round(bookingRules.depositRate * 100);
const transferHours = Math.round(bankTransferConfig.holdMinutes / 60);

const vi: FaqGroup[] = [
  {
    title: "Đặt tour và thanh toán",
    items: [
      {
        q: "Đặt tour online như thế nào?",
        a: `Chọn tour, chọn ngày khởi hành và số khách, điền thông tin liên hệ rồi bấm "Giữ chỗ". Chỗ được giữ ${bookingRules.holdMinutes} phút để bạn đặt cọc; sau khi cọc, bạn nhận email xác nhận kèm đường link xem đơn.`,
      },
      {
        q: "Phải đặt cọc bao nhiêu?",
        a: `${deposit}% tổng tiền tour. Phần còn lại thanh toán trước ngày khởi hành.`,
        link: { href: "/payment", label: "Chính sách thanh toán" },
      },
      {
        q: "Có những cách thanh toán nào?",
        a: `Thẻ ATM nội địa, thẻ quốc tế hoặc QR ngân hàng qua VNPay, hoặc chuyển khoản VietQR. Chọn chuyển khoản thì chỗ được giữ ${transferHours} giờ để nhân viên xác nhận tiền về.`,
      },
      {
        q: "Đặt trước bao lâu?",
        a: `Đặt online được đến ${bookingRules.cutoffDays} ngày trước ngày khởi hành. Gần hơn, vui lòng nhắn Zalo hoặc gọi hotline để chúng tôi kiểm tra chỗ.`,
      },
    ],
  },
  {
    title: "Huỷ và đổi ngày",
    items: [
      {
        q: "Huỷ tour có được hoàn tiền không?",
        a: "Mức hoàn tiền tuỳ thời điểm huỷ so với ngày khởi hành, xem chi tiết trong chính sách huỷ. Để huỷ hoặc đổi ngày, nhắn Zalo / gọi hotline kèm mã đơn.",
        link: { href: "/cancellation", label: "Chính sách huỷ tour" },
      },
      {
        q: "Tour bị huỷ do thời tiết thì sao?",
        a: "Khi có bão hoặc cơ quan chức năng cấm tàu, xe, chúng tôi báo trước và đề nghị đổi ngày hoặc hoàn tiền theo chính sách.",
        link: { href: "/cancellation", label: "Chính sách huỷ tour" },
      },
    ],
  },
  {
    title: "Trong chuyến đi",
    items: [
      {
        q: "Đón khách ở đâu, mấy giờ?",
        a: "Điểm và giờ đón ghi trên trang từng tour (mục Khởi hành). Trước ngày đi, chúng tôi xác nhận lại giờ đón qua Zalo hoặc email.",
      },
      {
        q: "Trẻ em và em bé tính giá thế nào?",
        a: "Trẻ em 5–10 tuổi được giảm giá (mức giảm ghi trên trang tour), em bé dưới 5 tuổi thường miễn phí và không chiếm chỗ. Giá chi tiết hiện ngay khi bạn chọn số khách.",
      },
      {
        q: "Cần mang theo gì?",
        a: "Phiếu xác nhận (in hoặc trên điện thoại), CCCD hoặc hộ chiếu của từng người, giày đi bộ, áo mưa mỏng; tour Sapa nên có áo ấm từ tháng 11 đến tháng 3.",
      },
    ],
  },
];

const en: FaqGroup[] = [
  {
    title: "Booking and payment",
    items: [
      {
        q: "How do I book online?",
        a: `Pick a tour, a departure date and the number of travellers, add your contact details and press "Hold my seats". Seats are held for ${bookingRules.holdMinutes} minutes while you pay the deposit; then you get a confirmation email with a link to your booking.`,
      },
      {
        q: "How much is the deposit?",
        a: `${deposit}% of the tour price. The balance is paid before departure.`,
        link: { href: "/payment", label: "Payment policy" },
      },
      {
        q: "How can I pay?",
        a: `Vietnamese ATM cards, international cards or bank QR through VNPay, or a VietQR bank transfer. With a bank transfer your seats are held for ${transferHours} hours while our team confirms the payment.`,
      },
      {
        q: "How far ahead must I book?",
        a: `Online booking closes ${bookingRules.cutoffDays} days before departure. For later dates, message us on WhatsApp and we will check availability.`,
      },
    ],
  },
  {
    title: "Cancellations and changes",
    items: [
      {
        q: "Can I get a refund if I cancel?",
        a: "Refunds depend on how long before departure you cancel; see the cancellation policy. To cancel or change dates, message us with your booking code.",
        link: { href: "/cancellation", label: "Cancellation policy" },
      },
      {
        q: "What if the tour is cancelled because of the weather?",
        a: "If a storm or the authorities stop boats or roads, we tell you in advance and offer another date or a refund under the policy.",
        link: { href: "/cancellation", label: "Cancellation policy" },
      },
    ],
  },
  {
    title: "On the trip",
    items: [
      {
        q: "Where and when is pick-up?",
        a: "Pick-up point and time are on each tour page (Departure). We confirm the pick-up time by WhatsApp or email before your trip.",
      },
      {
        q: "How are children and infants priced?",
        a: "Children aged 5–10 get a reduced price (shown on the tour page); infants under 5 are usually free and do not take a seat. The exact price appears as soon as you choose the number of travellers.",
      },
      {
        q: "What should I bring?",
        a: "Your voucher (printed or on your phone), a passport for each traveller, walking shoes and a light rain jacket; warm clothes for Sapa from November to March.",
      },
    ],
  },
];

export const getFaq = (locale: Locale): FaqGroup[] => (locale === "en" ? en : vi);
