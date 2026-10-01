// Project-owned: company contact channels (demo values — replace before going live).

export const contactConfig = {
  companyName: "Bắc Việt Travel",
  /** Shown in the footer and JSON-LD; required for Vietnamese tour operators. */
  licenseNumber: "01-xxx/2026/TCDL-GP LHQT (demo)",
  address: "Số 1 Phố Demo, Hoàn Kiếm, Hà Nội",
  hotline: "+84 900 000 000",
  email: "booking@bacviet.travel",
  /** Zalo phone number (digits only) → https://zalo.me/<number> */
  zalo: "0900000000",
  /** WhatsApp number in international format, digits only → https://wa.me/<number> */
  whatsapp: "84900000000",
  /** City for the TravelAgency JSON-LD. */
  city: "Hà Nội",
};

export const zaloUrl = (number = contactConfig.zalo) => `https://zalo.me/${number}`;
export const whatsappUrl = (text?: string, number = contactConfig.whatsapp) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const telUrl = (phone = contactConfig.hotline) => `tel:${phone.replace(/[^\d+]/g, "")}`;
