import type { Locale } from "@/config/app";
import type { StaffRole } from "./permissions";

/** Admin text for /admin/staff (H2). */
const vi = {
  title: "Nhân viên",
  intro: "Nhân viên đăng nhập web một lần (bằng email) để có tài khoản, rồi admin thêm ở đây. Quản lý làm mọi việc về đơn, lịch khởi hành, mã giảm giá và báo cáo. Sale xem đơn, nhập đơn, sửa thông tin liên hệ, ghi chú và danh sách khách; không xác nhận, huỷ đơn hay ghi nhận tiền.",
  email: "Email nhân viên",
  role: "Vai trò",
  roles: { manager: "Quản lý", sale: "Sale" } satisfies Record<StaffRole, string>,
  add: "Thêm / đổi vai trò",
  remove: "Gỡ",
  removeAsk: "Gỡ quyền nhân viên? Người này sẽ không vào được khu quản trị nữa.",
  empty: "Chưa có nhân viên nào.",
  cols: { email: "Email", role: "Vai trò", since: "Từ ngày" },
  result: {
    done: "Đã lưu.",
    not_found: "Chưa có tài khoản với email này. Nhờ nhân viên đăng nhập web một lần rồi thêm lại.",
    is_admin: "Người này là admin: đã có mọi quyền.",
    invalid: "Email hoặc vai trò không hợp lệ.",
    failed: "Không thực hiện được.",
  } as Record<string, string>,
};

const en: typeof vi = {
  title: "Staff",
  intro: "Staff sign in to the website once (by email) to get an account; then an admin adds them here. Managers handle all booking work, departures, discount codes and reports. Sales view and enter bookings, fix guest contact details, notes and passenger lists; they cannot confirm, cancel or record money.",
  email: "Staff email",
  role: "Role",
  roles: { manager: "Manager", sale: "Sales" },
  add: "Add / change role",
  remove: "Remove",
  removeAsk: "Remove staff access? This person will no longer open the admin area.",
  empty: "No staff yet.",
  cols: { email: "Email", role: "Role", since: "Since" },
  result: {
    done: "Saved.",
    not_found: "No account with this email yet. Ask them to sign in to the website once, then add them again.",
    is_admin: "This person is an admin and already has every permission.",
    invalid: "Invalid email or role.",
    failed: "Could not do that.",
  },
};

export const getStaffContent = (locale: Locale) => (locale === "en" ? en : vi);
