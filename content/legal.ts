import type { Locale } from "@/config/app";
import { contactConfig as co } from "@/config/contact";

export interface LegalDocument {
  updated: string;
  sections: { heading: string; body: string }[];
}

// Draft for the demo: have the final text reviewed before taking real bookings.
// Cancellation and payment policies live in product/policies.ts (they use the booking rules).
const legal: Record<Locale, { terms: LegalDocument; privacy: LegalDocument }> = {
  vi: {
    terms: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Đơn vị cung cấp dịch vụ", body: `Website do ${co.legalName} (MST ${co.taxCode}, giấy phép lữ hành số ${co.licenseNumber}) vận hành. Địa chỉ: ${co.address}. Hotline: ${co.hotline}.` },
        { heading: "2. Đặt tour", body: "Hợp đồng dịch vụ được xác lập khi khách đặt chỗ và thanh toán tiền cọc thành công. Xác nhận đặt chỗ được gửi qua email kèm mã booking." },
        { heading: "3. Giá tour", body: "Giá tính bằng VND, đã gồm các dịch vụ ghi trong mục \"Bao gồm\" của từng tour. Các dịch vụ trong mục \"Không bao gồm\" do khách tự chi trả." },
        { heading: "4. Trách nhiệm của khách", body: "Cung cấp thông tin chính xác, có mặt đúng giờ đón, mang giấy tờ tuỳ thân hợp lệ và tuân thủ hướng dẫn an toàn của hướng dẫn viên." },
        { heading: "5. Thay đổi lịch trình", body: "Vì lý do thời tiết, an toàn hoặc yêu cầu của cơ quan chức năng, công ty có thể điều chỉnh lịch trình và sẽ thông báo sớm nhất cho khách." },
        { heading: "6. Giải quyết tranh chấp", body: "Hai bên ưu tiên thương lượng. Nếu không thống nhất, tranh chấp được giải quyết theo pháp luật Việt Nam." },
      ],
    },
    privacy: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Dữ liệu chúng tôi thu thập", body: "Họ tên, email, số điện thoại, số lượng và độ tuổi khách, ghi chú bạn gửi khi đặt tour. Thông tin thẻ do cổng thanh toán VNPay xử lý, chúng tôi không lưu số thẻ." },
        { heading: "2. Mục đích", body: "Thực hiện đặt chỗ, liên lạc về chuyến đi, gửi xác nhận và nhắc lịch, đáp ứng nghĩa vụ kế toán, thuế." },
        { heading: "3. Chia sẻ dữ liệu", body: "Chỉ chia sẻ phần cần thiết với đối tác trực tiếp cung cấp dịch vụ (du thuyền, nhà xe, cơ sở lưu trú) và cổng thanh toán. Không bán dữ liệu cá nhân." },
        { heading: "4. Thời gian lưu trữ", body: "Dữ liệu đặt tour được lưu trong thời hạn pháp luật về kế toán yêu cầu, sau đó được xoá hoặc ẩn danh." },
        { heading: "5. Quyền của bạn", body: `Theo Nghị định 13/2023/NĐ-CP, bạn có quyền được biết, truy cập, chỉnh sửa, xoá dữ liệu và rút lại sự đồng ý. Gửi yêu cầu tới ${co.email}.` },
        { heading: "6. Cookie", body: "Website chỉ dùng cookie cần thiết để vận hành (ví dụ: ghi nhớ booking bạn vừa đặt), không dùng cookie quảng cáo." },
      ],
    },
  },
  en: {
    terms: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Service provider", body: `This website is operated by ${co.legalName} (tax code ${co.taxCode}, tour operator licence ${co.licenseNumber}). Address: ${co.address}. Hotline: ${co.hotline}.` },
        { heading: "2. Booking a tour", body: "The service contract is formed when you book and your deposit payment succeeds. You receive a confirmation email with your booking code." },
        { heading: "3. Prices", body: "Prices are in VND and include the services listed under \"Included\" for each tour. Services under \"Not included\" are paid by the traveller." },
        { heading: "4. Traveller responsibilities", body: "Provide accurate details, be on time for pick-up, carry valid ID and follow the guide's safety instructions." },
        { heading: "5. Itinerary changes", body: "For weather, safety or authority requirements we may adjust the itinerary and will tell you as early as possible." },
        { heading: "6. Disputes", body: "Both parties will first try to settle amicably; otherwise disputes are resolved under Vietnamese law." },
      ],
    },
    privacy: {
      updated: "2026-10-05",
      sections: [
        { heading: "1. Data we collect", body: "Name, email, phone number, number and ages of travellers, and the notes you send when booking. Card details are handled by the VNPay payment gateway; we never store card numbers." },
        { heading: "2. Purpose", body: "To make your booking, contact you about the trip, send confirmations and reminders, and meet accounting and tax obligations." },
        { heading: "3. Sharing", body: "Only what is needed is shared with the partners delivering your trip (cruise, transport, accommodation) and the payment gateway. We never sell personal data." },
        { heading: "4. Retention", body: "Booking data is kept for the period required by accounting law, then deleted or anonymised." },
        { heading: "5. Your rights", body: `Under Decree 13/2023/ND-CP you may access, correct and delete your data and withdraw consent. Write to ${co.email}.` },
        { heading: "6. Cookies", body: "We only use cookies needed to run the site (for example, remembering the booking you just made), no advertising cookies." },
      ],
    },
  },
};

export function getLegalDocument(locale: Locale, doc: "terms" | "privacy"): LegalDocument {
  return legal[locale][doc];
}
