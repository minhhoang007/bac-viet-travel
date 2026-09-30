import type { Locale } from "@/config/app";

export interface LegalDocument {
  updated: string;
  sections: { heading: string; body: string }[];
}

// TEMPLATE ONLY — replace with text reviewed for your business and jurisdiction.
const legal: Record<Locale, { terms: LegalDocument; privacy: LegalDocument }> = {
  vi: {
    terms: {
      updated: "2026-09-30",
      sections: [
        { heading: "1. Chấp nhận điều khoản", body: "Khi sử dụng dịch vụ, bạn đồng ý với các điều khoản này." },
        { heading: "2. Tài khoản", body: "Bạn chịu trách nhiệm về hoạt động trong tài khoản của mình." },
        { heading: "3. Chấm dứt", body: "Bạn có thể xoá tài khoản bất cứ lúc nào trong trang Tài khoản." },
      ],
    },
    privacy: {
      updated: "2026-09-30",
      sections: [
        { heading: "1. Dữ liệu thu thập", body: "Email, tên và dữ liệu bạn tạo trong ứng dụng." },
        { heading: "2. Mục đích", body: "Cung cấp dịch vụ, đăng nhập và liên lạc với bạn." },
        { heading: "3. Quyền của bạn", body: "Bạn có thể xuất hoặc xoá toàn bộ dữ liệu trong trang Tài khoản." },
      ],
    },
  },
  en: {
    terms: {
      updated: "2026-09-30",
      sections: [
        { heading: "1. Acceptance", body: "By using the service you agree to these terms." },
        { heading: "2. Accounts", body: "You are responsible for activity in your account." },
        { heading: "3. Termination", body: "You can delete your account at any time from the Account page." },
      ],
    },
    privacy: {
      updated: "2026-09-30",
      sections: [
        { heading: "1. Data we collect", body: "Email, name and the data you create in the app." },
        { heading: "2. Purpose", body: "To provide the service, sign you in and contact you." },
        { heading: "3. Your rights", body: "You can export or delete all of your data from the Account page." },
      ],
    },
  },
};

export function getLegalDocument(locale: Locale, doc: "terms" | "privacy"): LegalDocument {
  return legal[locale][doc];
}
