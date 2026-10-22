// Pure (no database code): the company details and bank account an admin edits in Admin → Thông tin công ty.
// config/contact.ts and config/bank-transfer.ts stay the defaults until the first save.
import { z } from "zod";
import { defaultBankTransfer as bankTransferConfig } from "@/config/bank-transfer";
import { defaultContact as contactConfig } from "@/config/contact";
import { hasPhoneDigits } from "../booking/validations";

export const COMPANY_CACHE_TAG = "site-company";

const line = (max: number) => z.string().trim().min(1).max(max);
// "" from the form and null once stored both mean "none".
const optionalUrl = z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.url({ protocol: /^https$/ }).max(500).nullable());

export const companySchema = z.object({
  legalName: line(200),
  taxCode: line(50),
  licenseNumber: line(100),
  representative: line(100),
  address: line(300),
  hotline: z.string().trim().regex(/^\+?[\d\s.]{8,20}$/).refine(hasPhoneDigits),
  email: z.email().max(200),
  /** Digits only, as Zalo links expect them. */
  zalo: z.string().trim().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(9).max(15)),
  whatsapp: z.string().trim().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(9).max(15)),
  hoursShort: line(40),
  businessHoursVi: line(100),
  businessHoursEn: line(100),
  moitNoticeUrl: optionalUrl,
  googleReviewUrl: optionalUrl,
});
export type CompanyInput = z.infer<typeof companySchema>;

/** Banks guests transfer to most (NAPAS BIN → name shown on the VietQR page). */
export const BANKS = {
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970418": "BIDV",
  "970405": "Agribank",
  "970422": "MB",
  "970407": "Techcombank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970403": "Sacombank",
} as const;

export const bankSchema = z.object({
  bankBin: z.enum(Object.keys(BANKS) as [keyof typeof BANKS, ...(keyof typeof BANKS)[]]),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/),
  /** Exactly as the bank shows it: upper case, no accents. */
  accountName: z.string().trim().regex(/^[A-Z0-9 .&-]{3,100}$/),
  /** Off: the transfer option shows only in payments sandbox mode, with a "do not transfer" warning. */
  live: z.boolean(),
});
export type BankInput = z.infer<typeof bankSchema>;

export type Company = typeof contactConfig;
export type BankTransfer = typeof bankTransferConfig;

/** Stored company details over the defaults; a stored value that no longer parses is ignored. */
export function applyCompany(stored: unknown): Company {
  const parsed = companySchema.safeParse(stored);
  if (!parsed.success) return contactConfig;
  const { businessHoursVi, businessHoursEn, ...rest } = parsed.data;
  return { ...contactConfig, ...rest, businessHours: { vi: businessHoursVi, en: businessHoursEn } };
}

export function applyBank(stored: unknown): BankTransfer {
  const parsed = bankSchema.safeParse(stored);
  if (!parsed.success) return bankTransferConfig;
  const { live, bankBin, ...rest } = parsed.data;
  return { ...bankTransferConfig, ...rest, bankBin, bankName: BANKS[bankBin], demo: !live };
}

/** The form's starting values. */
export const companyFormValues = (c: Company): Record<keyof CompanyInput, string> => ({
  legalName: c.legalName,
  taxCode: c.taxCode,
  licenseNumber: c.licenseNumber,
  representative: c.representative,
  address: c.address,
  hotline: c.hotline,
  email: c.email,
  zalo: c.zalo,
  whatsapp: c.whatsapp,
  hoursShort: c.hoursShort,
  businessHoursVi: c.businessHours.vi,
  businessHoursEn: c.businessHours.en,
  moitNoticeUrl: c.moitNoticeUrl ?? "",
  googleReviewUrl: c.googleReviewUrl ?? "",
});

/** Values still holding the "(demo)" placeholders: the admin page and launch:check point at them. */
export const demoFields = (c: Company): (keyof CompanyInput)[] =>
  (Object.entries(companyFormValues(c)) as [keyof CompanyInput, string][]).filter(([, v]) => v.includes("(demo)")).map(([k]) => k);
