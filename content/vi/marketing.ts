import type { MarketingContent } from "../types";

export const marketing: MarketingContent = {
  meta: {
    title: "Tour Hạ Long, Ninh Bình, Sapa khởi hành từ Hà Nội",
    description: "Bắc Việt Travel: tour du thuyền Hạ Long, Tràng An – Hang Múa, trekking Sapa. Giá minh bạch, nhóm nhỏ, hướng dẫn viên địa phương.",
  },
  nav: { switchLocale: "English", menu: "Mở menu", close: "Đóng" },
  hero: {
    eyebrow: "Bắc Việt Travel · Tour miền Bắc từ Hà Nội",
    title: "Khám phá Hạ Long, Ninh Bình và Sapa theo cách của bạn",
    subtitle: "Du thuyền ngủ đêm trên vịnh, thuyền qua hang động Tràng An, trekking ruộng bậc thang. Nhóm nhỏ, giá trọn gói, hỗ trợ 24/7 qua Zalo.",
    primaryCta: "Xem tour",
    primaryHref: "/tours",
    secondaryCta: "Nhận tư vấn",
    secondaryHref: "#contact",
    image: { src: "/tours/halong-1.jpg", alt: "Du thuyền giữa các đảo đá vôi trên vịnh Hạ Long" },
  },
  features: {
    title: "Đặt tour dễ dàng",
    items: [
      { title: "1. Chọn tour", description: "Xem lịch trình chi tiết, giá bao gồm và không bao gồm." },
      { title: "2. Gửi yêu cầu", description: "Điền form hoặc nhắn Zalo / WhatsApp, không cần thanh toán trước." },
      { title: "3. Xác nhận", description: "Chúng tôi gọi lại trong 24 giờ để chốt lịch và giá." },
    ],
  },
  faq: {
    title: "Câu hỏi thường gặp",
    items: [
      { question: "Tour có đón tại khách sạn không?", answer: "Có. Tất cả tour đón miễn phí tại khách sạn hoặc nhà riêng trong khu phố cổ Hà Nội." },
      { question: "Khi nào phải thanh toán?", answer: "Sau khi chúng tôi xác nhận lịch, bạn đặt cọc 30% qua chuyển khoản; phần còn lại thanh toán trước ngày khởi hành." },
      { question: "Huỷ tour có mất phí không?", answer: "Huỷ trước 7 ngày được hoàn cọc 100%. Huỷ do thời tiết xấu theo thông báo của cơ quan chức năng được đổi ngày hoặc hoàn tiền." },
      { question: "Trẻ em tính giá thế nào?", answer: "Trẻ dưới 5 tuổi miễn phí, 5–10 tuổi tính 75% giá người lớn (tuỳ tour)." },
    ],
  },
  cta: { title: "Cần tư vấn lịch trình riêng?", subtitle: "Gửi tin nhắn cho chúng tôi, hoặc chat ngay qua Zalo.", button: "Liên hệ" },
  contact: {
    name: "Họ tên",
    email: "Email",
    message: "Nội dung",
    submit: "Gửi",
    sending: "Đang gửi…",
    success: "Cảm ơn bạn! Chúng tôi sẽ phản hồi sớm.",
    errors: {
      required: "Vui lòng nhập trường này.",
      invalid_email: "Email không hợp lệ.",
      too_long: "Nội dung quá dài.",
      rate_limited: "Bạn gửi quá nhiều lần. Vui lòng thử lại sau.",
      error: "Không gửi được. Vui lòng thử lại.",
    },
  },
  footer: { rights: "Bảo lưu mọi quyền." },
  error: {
    title: "Đã có lỗi xảy ra",
    text: "Xin lỗi, trang gặp sự cố. Vui lòng thử lại sau ít phút.",
    retry: "Thử lại",
    back: "Về trang chủ",
  },
  notFound: { title: "Không tìm thấy trang", back: "Về trang chủ" },
};
