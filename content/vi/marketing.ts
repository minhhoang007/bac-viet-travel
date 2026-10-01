import type { MarketingContent } from "../types";

export const marketing: MarketingContent = {
  meta: {
    title: "Nền tảng khởi đầu cho website và web app",
    description: "Minh Starter giúp dựng website dịch vụ và web app nhanh, ổn định, dễ bảo trì.",
  },
  nav: { switchLocale: "English", menu: "Mở menu", close: "Đóng" },
  hero: {
    eyebrow: "Minh Web App Starter",
    title: "Xây sản phẩm, không dựng lại hạ tầng",
    subtitle: "Cấu hình, nội dung, SEO, bảo mật và kiến trúc đã sẵn sàng. Bạn chỉ tập trung vào phần sản phẩm.",
    primaryCta: "Bắt đầu",
    primaryHref: "#contact",
    secondaryCta: "Xem tính năng",
    secondaryHref: "#features",
  },
  features: {
    title: "Có sẵn những gì",
    items: [
      { title: "Đa ngôn ngữ", description: "Tiếng Việt và tiếng Anh, nội dung tách khỏi giao diện." },
      { title: "SEO chuẩn", description: "Metadata, sitemap, robots, hreflang được sinh tự động." },
      { title: "Kiến trúc có kiểm chứng", description: "Luật phân tầng được kiểm tra tự động trong CI." },
    ],
  },
  faq: {
    title: "Câu hỏi thường gặp",
    items: [
      { question: "Starter này dành cho ai?", answer: "Cho website dịch vụ và web app cần nền tảng ổn định để tái sử dụng." },
      { question: "Có cần database không?", answer: "Không với profile site. Profile app mới cần database và đăng nhập." },
    ],
  },
  cta: { title: "Sẵn sàng bắt đầu?", subtitle: "Clone starter, chỉnh cấu hình và xây sản phẩm của bạn.", button: "Liên hệ" },
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
