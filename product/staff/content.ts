import type { Locale } from "@/config/app";
import type { StaffRole } from "./permissions";

/** Admin text for /admin/staff (H2). */
const vi = {
  title: "Nhân viên",
  intro: "Nhập email và chọn vai trò. Nhân viên chưa có tài khoản sẽ nhận email để tự đặt mật khẩu (liên kết dùng trong 24 giờ); lần đầu, họ đăng nhập bằng liên kết gửi qua email rồi cài xác thực hai lớp (mật khẩu chỉ dùng được sau bước này). Quản lý làm mọi việc về đơn, lịch khởi hành, mã giảm giá và báo cáo. Sale xem đơn, nhập đơn, sửa thông tin liên hệ, ghi chú và danh sách khách; không xác nhận, huỷ đơn hay ghi nhận tiền. Mọi nhân viên (cả Sale) viết được blog và quản lý ảnh; chỉ admin xuất bản.",
  email: "Email nhân viên",
  role: "Vai trò",
  roles: { manager: "Quản lý", sale: "Sale" } satisfies Record<StaffRole, string>,
  add: "Thêm / đổi vai trò",
  remove: "Gỡ",
  removeAsk: "Gỡ quyền nhân viên? Người này sẽ không vào được khu quản trị nữa.",
  sendLink: "Gửi link đặt mật khẩu",
  empty: "Chưa có nhân viên nào.",
  cols: { email: "Email", role: "Vai trò", since: "Từ ngày" },
  result: {
    done: "Đã lưu.",
    invited: "Đã tạo tài khoản và gửi email để nhân viên đặt mật khẩu.",
    link_sent: "Đã gửi email đặt mật khẩu; các link gửi trước không còn dùng được. Mật khẩu cũ vẫn dùng được cho tới khi họ đặt mật khẩu mới.",
    not_staff: "Người này không phải nhân viên đang hoạt động: không gửi link.",
    mail_failed: "Đã lưu nhưng chưa gửi được email. Bấm “Gửi link đặt mật khẩu” sau ít phút.",
    not_found: "Chưa có tài khoản với email này. Nhờ nhân viên đăng nhập web một lần rồi thêm lại.",
    is_admin: "Người này là admin: đã có mọi quyền.",
    disabled: "Tài khoản này đang bị khoá. Mở khoá ở trang Tài khoản người dùng trước, rồi thêm lại.",
    invalid: "Email hoặc vai trò không hợp lệ.",
    failed: "Không thực hiện được.",
  } as Record<string, string>,
};

const en: typeof vi = {
  title: "Staff",
  intro: "Enter an email and pick a role. Staff without an account get an email to set their own password (the link works for 24 hours); the first time, they sign in with an emailed link and set up two-step verification (the password works only after that). Managers handle all booking work, departures, discount codes and reports. Sales view and enter bookings, fix guest contact details, notes and passenger lists; they cannot confirm, cancel or record money. All staff (Sales included) can write blog posts and manage images; only admins publish.",
  email: "Staff email",
  role: "Role",
  roles: { manager: "Manager", sale: "Sales" },
  add: "Add / change role",
  remove: "Remove",
  removeAsk: "Remove staff access? This person will no longer open the admin area.",
  sendLink: "Send a password link",
  empty: "No staff yet.",
  cols: { email: "Email", role: "Role", since: "Since" },
  result: {
    done: "Saved.",
    invited: "Account created; an email asks them to set a password.",
    link_sent: "Password email sent; links sent before no longer work. Their current password still works until they set a new one.",
    not_staff: "This person is not active staff: no link sent.",
    mail_failed: "Saved, but the email did not go out. Press “Send a password link” in a few minutes.",
    not_found: "No account with this email yet. Ask them to sign in to the website once, then add them again.",
    is_admin: "This person is an admin and already has every permission.",
    disabled: "This account is disabled. Enable it on the user accounts page first, then add them again.",
    invalid: "Invalid email or role.",
    failed: "Could not do that.",
  },
};

export const getStaffContent = (locale: Locale) => (locale === "en" ? en : vi);
