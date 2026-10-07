import type { Locale } from "@/config/app";

/** Admin text for discount codes (D6). */
const vi = {
  title: "Mã giảm giá",
  add: "Tạo mã mới",
  create: "Tạo mã",
  empty: "Chưa có mã nào.",
  allTours: "Mọi tour",
  unlimited: "Không giới hạn",
  fields: {
    code: "Mã (chữ, số, gạch ngang)",
    kind: "Loại",
    value: "Giá trị (% hoặc VND)",
    tourSlug: "Áp dụng cho",
    validFrom: "Từ ngày",
    validTo: "Đến ngày",
    minTotalVnd: "Đơn tối thiểu (VND)",
    maxUses: "Số lượt tối đa",
    note: "Ghi chú nội bộ",
  },
  kinds: { percent: "Phần trăm (%)", amount: "Số tiền (VND)" },
  cols: ["Mã", "Giảm", "Hiệu lực", "Tour", "Đã dùng", "Trạng thái", ""],
  status: { on: "Đang chạy", off: "Đã tắt", ended: "Hết hạn" },
  enable: "Bật",
  disable: "Tắt",
  result: {
    done: "Đã lưu.",
    taken: "Mã này đã tồn tại.",
    invalid: (field: string) => `Ô "${field}" chưa hợp lệ (phần trăm tối đa 90, ngày kết thúc không trước ngày bắt đầu).`,
    failed: "Không thực hiện được.",
  },
};

const en: typeof vi = {
  title: "Discount codes",
  add: "New code",
  create: "Create code",
  empty: "No codes yet.",
  allTours: "All tours",
  unlimited: "Unlimited",
  fields: {
    code: "Code (letters, digits, dashes)",
    kind: "Type",
    value: "Value (% or VND)",
    tourSlug: "Applies to",
    validFrom: "From",
    validTo: "To",
    minTotalVnd: "Minimum total (VND)",
    maxUses: "Maximum uses",
    note: "Internal note",
  },
  kinds: { percent: "Percent (%)", amount: "Amount (VND)" },
  cols: ["Code", "Off", "Valid", "Tour", "Used", "Status", ""],
  status: { on: "Active", off: "Off", ended: "Ended" },
  enable: "Turn on",
  disable: "Turn off",
  result: {
    done: "Saved.",
    taken: "This code already exists.",
    invalid: (field) => `"${field}" is not valid (percent up to 90, end date not before the start).`,
    failed: "Could not do that.",
  },
};

export const getDiscountAdminContent = (locale: Locale) => (locale === "en" ? en : vi);
