import type { Locale } from "@/config/app";

/** Text of the admin dashboard (/admin). */
const vi = {
  kpi: {
    collected: "Đã thu tháng này",
    bookings: "Đơn đặt cọc 7 ngày",
    value: "Giá trị đơn 7 ngày",
    fill: "Lấp chỗ 30 ngày tới",
  },
  vsLastMonth: (pct: string) => `${pct} so với cùng kỳ tháng trước`,
  vsLastWeek: (diff: string) => `${diff} so với 7 ngày trước`,
  noBaseline: "chưa có kỳ trước để so",
  seats: (sold: number, cap: number) => `${sold}/${cap} chỗ`,
  queueTitle: "Cần xử lý",
  queueEmpty: "Không có việc tồn. Mọi đơn đã được xử lý.",
  queue: {
    transfers: "Chuyển khoản chờ xác nhận",
    toConfirm: "Đơn đã cọc, chờ xác nhận",
    refunds: "Đơn huỷ chờ hoàn tiền",
    expiringHolds: "Giữ chỗ hết hạn trong 2 giờ",
    lowFill: "Chuyến 7 ngày tới dưới 50% chỗ",
  },
  revenueTitle: "Tiền đã thu 30 ngày",
  revenueTotal: (v: string) => `Tổng: ${v}`,
  byTourTitle: "Theo tour (30 ngày)",
  bookingsCount: (n: number) => `${n} đơn`,
  upcomingTitle: "Khởi hành 14 ngày tới",
  upcomingEmpty: "Chưa có chuyến nào có khách trong 14 ngày tới.",
  recentTitle: "Đơn mới nhất",
  all: "Xem tất cả",
  noData: "Chưa có dữ liệu.",
};

const en: typeof vi = {
  kpi: {
    collected: "Collected this month",
    bookings: "Paid bookings, 7 days",
    value: "Booking value, 7 days",
    fill: "Seats filled, next 30 days",
  },
  vsLastMonth: (pct) => `${pct} vs same days last month`,
  vsLastWeek: (diff) => `${diff} vs previous 7 days`,
  noBaseline: "no previous period yet",
  seats: (sold, cap) => `${sold}/${cap} seats`,
  queueTitle: "To do",
  queueEmpty: "Nothing waiting. Every booking is handled.",
  queue: {
    transfers: "Bank transfers to confirm",
    toConfirm: "Paid deposits to confirm",
    refunds: "Cancelled bookings to refund",
    expiringHolds: "Holds expiring within 2 hours",
    lowFill: "Departures in 7 days under 50% full",
  },
  revenueTitle: "Money collected, 30 days",
  revenueTotal: (v) => `Total: ${v}`,
  byTourTitle: "By tour (30 days)",
  bookingsCount: (n) => `${n} bookings`,
  upcomingTitle: "Departures, next 14 days",
  upcomingEmpty: "No departures with guests in the next 14 days.",
  recentTitle: "Latest bookings",
  all: "See all",
  noData: "No data yet.",
};

export const getDashboardContent = (locale: Locale) => (locale === "en" ? en : vi);
