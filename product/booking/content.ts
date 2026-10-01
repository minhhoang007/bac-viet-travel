import type { Locale } from "@/config/app";
import type { BookingFieldError } from "./service";

/** UI text for online booking (project-owned). */
const vi = {
  cta: "Đặt tour online",
  ctaHint: "Chọn ngày khởi hành, giữ chỗ ngay trong 15 phút.",
  pageTitle: (tour: string) => `Đặt tour: ${tour}`,
  departuresTitle: "Chọn ngày khởi hành",
  noDepartures: "Hiện chưa có lịch khởi hành. Vui lòng gửi yêu cầu hoặc nhắn Zalo để chọn ngày riêng.",
  seatsLeft: (n: number) => (n <= 5 ? `Chỉ còn ${n} chỗ` : `Còn ${n} chỗ`),
  soldOut: "Hết chỗ",
  closed: "Đã đóng",
  tooSoon: "Hết hạn đặt",
  choose: "Chọn",
  chosen: "Đã chọn",
  formTitle: "Thông tin người đặt",
  name: "Họ tên",
  email: "Email",
  phone: "Số điện thoại / WhatsApp",
  adults: "Người lớn",
  children: "Trẻ em (5–10 tuổi)",
  infants: "Em bé (dưới 5 tuổi, miễn phí)",
  note: "Ghi chú (điểm đón, ăn chay…)",
  summary: "Tạm tính",
  adultLine: (n: number) => `${n} người lớn`,
  childLine: (n: number) => `${n} trẻ em (75%)`,
  total: "Tổng tiền",
  deposit: "Đặt cọc (30%)",
  rest: "Thanh toán phần còn lại trước ngày đi",
  submit: "Giữ chỗ 15 phút",
  sending: "Đang giữ chỗ…",
  vndNote: "Giá thanh toán bằng VND.",
  errors: {
    required: "Vui lòng nhập thông tin này.",
    invalid: "Thông tin không hợp lệ.",
    too_long: "Nội dung quá dài.",
    too_many: "Tối đa 10 khách (người lớn + trẻ em) mỗi đơn.",
    sold_out: (n: number) => (n > 0 ? `Chỉ còn ${n} chỗ cho ngày này. Vui lòng giảm số khách hoặc chọn ngày khác.` : "Ngày này vừa hết chỗ. Vui lòng chọn ngày khác."),
    unavailable: "Ngày này không còn nhận đặt. Vui lòng chọn ngày khác.",
    rate_limited: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút hoặc nhắn Zalo cho chúng tôi.",
    error: "Không giữ được chỗ. Vui lòng thử lại.",
  } satisfies Record<BookingFieldError | "unavailable" | "rate_limited" | "error", string> & { sold_out: (n: number) => string },
  booking: {
    title: "Đơn đặt tour",
    code: "Mã đơn",
    tour: "Tour",
    date: "Ngày khởi hành",
    guests: "Số khách",
    contact: "Người đặt",
    heldTitle: "Đã giữ chỗ cho bạn",
    heldText: "Chỗ được giữ trong 15 phút. Hãy lưu lại đường link này để xem lại đơn.",
    remaining: "Thời gian giữ chỗ còn",
    payNext: "Thanh toán đặt cọc qua VNPay sẽ có ở bước tiếp theo.",
    expiredTitle: "Đã hết thời gian giữ chỗ",
    expiredText: "Chỗ đã được nhả cho khách khác. Bạn có thể đặt lại nếu ngày này còn chỗ.",
    rebook: "Đặt lại",
    status: { held: "Đang giữ chỗ", expired: "Hết hạn", deposit_paid: "Đã đặt cọc", confirmed: "Đã xác nhận", cancelled: "Đã huỷ" },
    notFound: "Không tìm thấy đơn. Vui lòng kiểm tra lại đường link.",
  },
};

type BookingContent = typeof vi;

const en: BookingContent = {
  cta: "Book online",
  ctaHint: "Pick a departure date and hold your seats for 15 minutes.",
  pageTitle: (tour) => `Book: ${tour}`,
  departuresTitle: "Choose a departure date",
  noDepartures: "No scheduled departures right now. Send us a request or message us on WhatsApp for a private date.",
  seatsLeft: (n) => (n <= 5 ? `Only ${n} left` : `${n} seats left`),
  soldOut: "Sold out",
  closed: "Closed",
  tooSoon: "Booking closed",
  choose: "Select",
  chosen: "Selected",
  formTitle: "Your details",
  name: "Full name",
  email: "Email",
  phone: "Phone / WhatsApp",
  adults: "Adults",
  children: "Children (5–10)",
  infants: "Infants (under 5, free)",
  note: "Notes (hotel pick-up, dietary needs…)",
  summary: "Estimate",
  adultLine: (n) => `${n} adult${n > 1 ? "s" : ""}`,
  childLine: (n) => `${n} child${n > 1 ? "ren" : ""} (75%)`,
  total: "Total",
  deposit: "Deposit (30%)",
  rest: "Pay the balance before departure",
  submit: "Hold seats for 15 minutes",
  sending: "Holding seats…",
  vndNote: "Charged in Vietnamese dong (VND).",
  errors: {
    required: "Please fill in this field.",
    invalid: "Please check this value.",
    too_long: "Text is too long.",
    too_many: "Up to 10 guests (adults + children) per booking.",
    sold_out: (n) => (n > 0 ? `Only ${n} seats left on this date. Reduce the group or choose another date.` : "This date just sold out. Please choose another date."),
    unavailable: "This date is no longer bookable. Please choose another date.",
    rate_limited: "Too many attempts. Please try again in a few minutes or message us on WhatsApp.",
    error: "Could not hold your seats. Please try again.",
  },
  booking: {
    title: "Your booking",
    code: "Booking code",
    tour: "Tour",
    date: "Departure",
    guests: "Guests",
    contact: "Booked by",
    heldTitle: "Your seats are on hold",
    heldText: "We hold your seats for 15 minutes. Keep this link to view your booking again.",
    remaining: "Hold time left",
    payNext: "Deposit payment with VNPay comes in the next step.",
    expiredTitle: "Your hold has expired",
    expiredText: "The seats were released. You can book again if the date still has seats.",
    rebook: "Book again",
    status: { held: "On hold", expired: "Expired", deposit_paid: "Deposit paid", confirmed: "Confirmed", cancelled: "Cancelled" },
    notFound: "Booking not found. Please check your link.",
  },
};

export function getBookingContent(locale: Locale): BookingContent {
  return locale === "en" ? en : vi;
}

export const formatVnd = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

/** "Thứ Sáu, 09/10/2026" / "Fri, 9 Oct 2026" — dates are calendar days, formatted in UTC so they never shift. */
export const formatDay = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", { weekday: locale === "vi" ? "long" : "short", day: "numeric", month: locale === "vi" ? "2-digit" : "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
