import type { Locale } from "@/config/app";
import type { BankInput, CompanyInput } from "./settings";

type Field = { label: string; hint?: string };

const vi = {
  title: "Thông tin công ty",
  intro: "Hiện ở chân trang, trang Giới thiệu, Liên hệ, các chính sách và nút gọi / Zalo / WhatsApp. Lưu xong, website cập nhật ngay.",
  demo: (n: number) => `Còn ${n} mục đang là dữ liệu mẫu "(demo)" (tô vàng bên dưới): thay bằng thông tin thật trước khi bán.`,
  company: "Công ty và liên hệ",
  fields: {
    legalName: { label: "Tên pháp nhân", hint: "Đúng như giấy đăng ký kinh doanh." },
    taxCode: { label: "Mã số thuế" },
    licenseNumber: { label: "Số giấy phép lữ hành" },
    representative: { label: "Người đại diện theo pháp luật" },
    address: { label: "Địa chỉ" },
    hotline: { label: "Hotline", hint: "Ví dụ +84 912 345 678." },
    email: { label: "Email nhận đặt tour" },
    zalo: { label: "Số Zalo", hint: "Số điện thoại đăng ký Zalo." },
    whatsapp: { label: "Số WhatsApp", hint: "Dạng quốc tế, ví dụ 84912345678." },
    hoursShort: { label: "Giờ làm việc (ngắn, trên đầu trang)", hint: "Ví dụ 8:00–21:00." },
    businessHoursVi: { label: "Giờ làm việc (tiếng Việt)" },
    businessHoursEn: { label: "Giờ làm việc (tiếng Anh)" },
    moitNoticeUrl: { label: "Link thông báo Bộ Công Thương (nếu có)", hint: "Bắt đầu bằng https://. Để trống nếu chưa có." },
    googleReviewUrl: { label: "Link đánh giá Google (nếu có)", hint: "Khách chấm 4–5 sao sau chuyến được mời đánh giá ở đây." },
  } satisfies Record<keyof CompanyInput, Field>,
  saveCompany: "Lưu thông tin công ty",
  bank: "Tài khoản nhận chuyển khoản",
  bankIntro: "Khách chuyển tiền cọc vào tài khoản này (mã VietQR trên trang đơn của khách). Kiểm tra kỹ: sai một số là tiền của khách đi nơi khác.",
  bankFields: {
    bankBin: { label: "Ngân hàng" },
    accountNumber: { label: "Số tài khoản", hint: "Chỉ chữ số." },
    accountName: { label: "Tên chủ tài khoản", hint: "Viết HOA, không dấu, đúng như ngân hàng hiển thị." },
    live: { label: "Đang dùng tài khoản thật: cho khách chọn chuyển khoản" },
  } satisfies Record<keyof BankInput, Field>,
  bankDemo: "Đang là tài khoản mẫu: khách chưa thấy lựa chọn chuyển khoản.",
  saveBank: "Lưu tài khoản ngân hàng",
  bankAsk: "Đổi tài khoản nhận tiền của khách? Mã QR trên các đơn đang chờ cũng đổi theo.",
  result: {
    done: "Đã lưu. Website đã cập nhật.",
    invalid: "Có mục chưa đúng, chưa lưu. Kiểm tra số điện thoại, email, link (https://…), số tài khoản và tên chủ tài khoản (HOA, không dấu).",
    failed: "Chưa lưu được. Thử lại sau ít phút.",
  } as Record<string, string>,
};

const en: typeof vi = {
  title: "Company details",
  intro: "Shown in the footer, About, Contact, the policies and the call / Zalo / WhatsApp buttons. The website updates as soon as you save.",
  demo: (n) => `${n} values are still "(demo)" placeholders (highlighted below): replace them before selling.`,
  company: "Company and contacts",
  fields: {
    legalName: { label: "Registered company name", hint: "As on the business registration." },
    taxCode: { label: "Tax code" },
    licenseNumber: { label: "Tour operator licence number" },
    representative: { label: "Legal representative" },
    address: { label: "Address" },
    hotline: { label: "Hotline", hint: "E.g. +84 912 345 678." },
    email: { label: "Booking email" },
    zalo: { label: "Zalo number", hint: "The phone number registered with Zalo." },
    whatsapp: { label: "WhatsApp number", hint: "International form, e.g. 84912345678." },
    hoursShort: { label: "Opening hours (short, top bar)", hint: "E.g. 8:00–21:00." },
    businessHoursVi: { label: "Opening hours (Vietnamese)" },
    businessHoursEn: { label: "Opening hours (English)" },
    moitNoticeUrl: { label: "Ministry of Industry and Trade notice link (if any)", hint: "Starts with https://. Leave empty if not yet." },
    googleReviewUrl: { label: "Google review link (if any)", hint: "Guests who rate 4–5 stars after a trip are invited there." },
  },
  saveCompany: "Save company details",
  bank: "Account for bank transfers",
  bankIntro: "Guests transfer their deposit to this account (VietQR code on their booking page). Check it carefully: one wrong digit sends their money elsewhere.",
  bankFields: {
    bankBin: { label: "Bank" },
    accountNumber: { label: "Account number", hint: "Digits only." },
    accountName: { label: "Account holder", hint: "UPPER CASE, no accents, exactly as the bank shows it." },
    live: { label: "This is the real account: let guests choose a bank transfer" },
  },
  bankDemo: "Demo account: guests do not see the bank transfer option yet.",
  saveBank: "Save bank account",
  bankAsk: "Change the account guests pay into? QR codes on pending bookings change too.",
  result: {
    done: "Saved. The website is updated.",
    invalid: "Some values are not valid, nothing saved. Check the phone numbers, email, links (https://…), account number and holder (UPPER CASE, no accents).",
    failed: "Could not save. Try again in a few minutes.",
  },
};

export const getCompanyContent = (locale: Locale) => (locale === "en" ? en : vi);
