// Project-owned: company identity and contact channels. The single place to edit before going live:
// footer, About page, policies and JSON-LD all read from here. Values marked (demo) must be replaced.

export const contactConfig = {
  /** Trading name shown in the header, emails and JSON-LD. */
  companyName: "Bắc Việt Travel",
  /** Registered company name (tên pháp nhân), as on the business registration. */
  legalName: "Công ty TNHH Du lịch Bắc Việt (demo)",
  /** Tax code / business registration number (mã số thuế). */
  taxCode: "0100000000 (demo)",
  /** Tour operator licence: required on the website of a Vietnamese tour operator. */
  licenseNumber: "01-xxx/2026/TCDL-GP LHQT (demo)",
  licenseType: { vi: "Giấy phép kinh doanh lữ hành quốc tế", en: "International tour operator licence" },
  /** Legal representative (người đại diện theo pháp luật). */
  representative: "Nguyễn Văn A (demo)",
  address: "Số 1 Phố Demo, Hoàn Kiếm, Hà Nội",
  hotline: "+84 900 000 000",
  email: "booking@bacviet.travel",
  /** Zalo phone number (digits only) → https://zalo.me/<number> */
  zalo: "0900000000",
  /** WhatsApp number in international format, digits only → https://wa.me/<number> */
  whatsapp: "84900000000",
  /** Short form for the header, e.g. "8:00–21:00". */
  hoursShort: "8:00–21:00",
  businessHours: { vi: "8:00 – 21:00 hằng ngày", en: "8:00 – 21:00 daily (GMT+7)" },
  /** City for the TravelAgency JSON-LD. */
  city: "Hà Nội",
  /** Ministry of Industry and Trade e-commerce notice (online.gov.vn): set the link once the website is notified. */
  moitNoticeUrl: null as string | null,
  /** Google review link of the business (Google Business Profile → "Ask for reviews"): guests who rate 4–5 after a
   * trip are invited there. null = not shown. */
  googleReviewUrl: null as string | null,
};

export const zaloUrl = (number = contactConfig.zalo) => `https://zalo.me/${number}`;
export const whatsappUrl = (text?: string, number = contactConfig.whatsapp) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const telUrl = (phone = contactConfig.hotline) => `tel:${phone.replace(/[^\d+]/g, "")}`;
