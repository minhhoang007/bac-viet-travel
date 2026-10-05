import type { Locale } from "@/config/app";
import { contactConfig as co } from "@/config/contact";
import type { LegalDocument } from "@/content/legal";
import { bookingRules } from "./booking/rules";

// Project-owned: cancellation and payment policies. Deposit rate, hold time and cut-off come from the booking rules,
// so the pages never disagree with what the booking flow does.
// DRAFT: the refund tiers below are placeholders until the owner sets the official policy.

/** Refund of the deposit by how many days before departure the guest cancels (first matching tier). */
export const cancellationTiers = [
  { minDays: 7, refundPercent: 100 },
  { minDays: 3, refundPercent: 50 },
  { minDays: 0, refundPercent: 0 },
] as const;

const deposit = Math.round(bookingRules.depositRate * 100);

function tiersText(locale: Locale): string {
  return cancellationTiers
    .map((t, i) => {
      const next = cancellationTiers[i - 1];
      if (locale === "vi") {
        const when = i === 0 ? `Trước ngày khởi hành từ ${t.minDays} ngày trở lên` : t.minDays === 0 ? `Dưới ${next!.minDays} ngày hoặc không đến` : `Từ ${t.minDays} đến ${next!.minDays - 1} ngày trước ngày khởi hành`;
        return `${when}: hoàn ${t.refundPercent}% tiền cọc.`;
      }
      const when = i === 0 ? `${t.minDays} days or more before departure` : t.minDays === 0 ? `Less than ${next!.minDays} days, or no-show` : `${t.minDays} to ${next!.minDays - 1} days before departure`;
      return `${when}: ${t.refundPercent}% of the deposit refunded.`;
    })
    .join(" ");
}

const policies: Record<Locale, { cancellation: LegalDocument; payment: LegalDocument }> = {
  vi: {
    cancellation: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Khách huỷ tour", body: tiersText("vi") },
        { heading: "2. Đổi ngày", body: "Khách được đổi ngày khởi hành miễn phí một lần nếu báo trước ít nhất 3 ngày và ngày mới còn chỗ; chênh lệch giá (nếu có) được tính bù." },
        { heading: "3. Công ty huỷ tour", body: "Nếu công ty huỷ tour vì thời tiết, an toàn hoặc không đủ khách, khách được chọn đổi ngày hoặc hoàn 100% số tiền đã thanh toán." },
        { heading: "4. Thời gian hoàn tiền", body: "Tiền hoàn được chuyển về tài khoản hoặc thẻ khách đã thanh toán trong 7–15 ngày làm việc, tuỳ ngân hàng." },
        { heading: "5. Cách gửi yêu cầu", body: `Gọi ${co.hotline}, nhắn Zalo hoặc email ${co.email}, kèm mã booking (BV-…).` },
      ],
    },
    payment: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Đặt cọc", body: `Khi đặt tour online, chỗ của bạn được giữ trong ${bookingRules.holdMinutes} phút để thanh toán tiền cọc ${deposit}% giá tour. Booking được ghi nhận khi cọc thành công.` },
        { heading: "2. Phần còn lại", body: "Phần còn lại thanh toán trước ngày khởi hành bằng chuyển khoản hoặc tiền mặt tại văn phòng, theo hướng dẫn trong email xác nhận." },
        { heading: "3. Phương thức", body: "Cổng VNPay: thẻ ATM nội địa, ứng dụng ngân hàng (QR) và thẻ quốc tế Visa, Mastercard, JCB. Chuyển khoản ngân hàng theo thông tin công ty cung cấp." },
        { heading: "4. An toàn thanh toán", body: "Giao dịch thẻ được xử lý trên trang của VNPay, đơn vị trung gian thanh toán được Ngân hàng Nhà nước cấp phép. Website không lưu thông tin thẻ." },
        { heading: "5. Hoá đơn", body: "Công ty xuất hoá đơn điện tử theo yêu cầu. Vui lòng gửi thông tin xuất hoá đơn trước ngày khởi hành." },
      ],
    },
  },
  en: {
    cancellation: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. If you cancel", body: tiersText("en") },
        { heading: "2. Changing the date", body: "You can move your departure date once for free with at least 3 days' notice if the new date has seats; any price difference is settled." },
        { heading: "3. If we cancel", body: "If we cancel for weather, safety or too few travellers, you choose a new date or a 100% refund of what you paid." },
        { heading: "4. Refund timing", body: "Refunds go back to the account or card you paid with within 7–15 business days, depending on your bank." },
        { heading: "5. How to request", body: `Call ${co.hotline}, message us on WhatsApp/Zalo or email ${co.email} with your booking code (BV-…).` },
      ],
    },
    payment: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Deposit", body: `When you book online your seats are held for ${bookingRules.holdMinutes} minutes while you pay a ${deposit}% deposit. The booking is recorded once the deposit succeeds.` },
        { heading: "2. Balance", body: "The balance is paid before departure by bank transfer or in cash at our office, as described in your confirmation email." },
        { heading: "3. Methods", body: "VNPay gateway: Vietnamese ATM cards, banking-app QR and international Visa, Mastercard and JCB cards. Bank transfer to the company account." },
        { heading: "4. Payment security", body: "Card payments are processed on VNPay's pages, a payment intermediary licensed by the State Bank of Vietnam. We never store card details." },
        { heading: "5. Invoices", body: "We issue e-invoices on request. Please send your invoice details before departure." },
      ],
    },
  },
};

export function getPolicy(locale: Locale, doc: "cancellation" | "payment"): LegalDocument {
  return policies[locale][doc];
}
