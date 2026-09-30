import type { AppContent } from "../app-types";

export const app: AppContent = {
  login: {
    title: "Đăng nhập",
    subtitle: "Nhận liên kết đăng nhập qua email, không cần mật khẩu.",
    email: "Email",
    sendLink: "Gửi liên kết đăng nhập",
    sending: "Đang gửi…",
    linkSent: "Đã gửi! Kiểm tra hộp thư và nhấn vào liên kết để đăng nhập.",
    or: "hoặc",
    google: "Tiếp tục với Google",
    errors: { invalid_email: "Email không hợp lệ.", error: "Không gửi được liên kết. Vui lòng thử lại." },
  },
  dashboard: {
    nav: { overview: "Tổng quan", account: "Tài khoản", notes: "Ghi chú" },
    signOut: "Đăng xuất",
    welcome: "Xin chào",
    overviewText: "Đây là dashboard mẫu. Phần sản phẩm nằm trong mục Ghi chú.",
  },
  account: {
    title: "Tài khoản",
    profile: "Thông tin",
    exportTitle: "Xuất dữ liệu",
    exportText: "Tải toàn bộ dữ liệu của bạn dưới dạng JSON.",
    exportButton: "Tải xuống",
    deleteTitle: "Xoá tài khoản",
    deleteText: "Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu. Không thể hoàn tác.",
    deleteConfirmLabel: "Nhập email của bạn để xác nhận",
    deleteButton: "Xoá tài khoản",
  },
  notes: {
    title: "Ghi chú",
    empty: "Chưa có ghi chú nào.",
    titleLabel: "Tiêu đề",
    bodyLabel: "Nội dung",
    create: "Thêm ghi chú",
    save: "Lưu",
    delete: "Xoá",
    back: "Quay lại",
    errors: { required: "Vui lòng nhập tiêu đề.", too_long: "Nội dung quá dài.", error: "Đã có lỗi. Vui lòng thử lại." },
  },
  legal: {
    terms: "Điều khoản sử dụng",
    privacy: "Chính sách quyền riêng tư",
    lastUpdated: "Cập nhật lần cuối",
    templateNotice: "Đây là mẫu. Hãy thay bằng nội dung pháp lý phù hợp với doanh nghiệp của bạn.",
  },
};
