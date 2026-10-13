import { describe, expect, it } from "vitest";
import { defaultBankTransfer } from "@/config/bank-transfer";
import { defaultContact } from "@/config/contact";
import { applyBank, applyCompany, bankSchema, companyFormValues, companySchema, demoFields } from "../settings";

const valid = { ...companyFormValues(defaultContact), legalName: "Công ty TNHH Du lịch Bắc Việt", taxCode: "0109999999", licenseNumber: "01-123/2026/TCDL-GP LHQT", representative: "Trần Văn B" };

describe("company settings", () => {
  it("defaults until saved; saved values replace them, opening hours by language", () => {
    expect(applyCompany(undefined)).toBe(defaultContact);
    const saved = applyCompany(companySchema.parse({ ...valid, hotline: "+84 912 345 678", businessHoursEn: "9:00 – 18:00" }));
    expect(saved).toMatchObject({ hotline: "+84 912 345 678", companyName: defaultContact.companyName, businessHours: { vi: defaultContact.businessHours.vi, en: "9:00 – 18:00" } });
  });

  it("a stored value that no longer parses falls back to the defaults", () => {
    expect(applyCompany({ ...valid, email: "not-an-email" })).toBe(defaultContact);
  });

  it("chat numbers keep digits only; links must be https or empty", () => {
    expect(companySchema.parse({ ...valid, zalo: "0912 345 678", whatsapp: "+84 912 345 678" })).toMatchObject({ zalo: "0912345678", whatsapp: "84912345678" });
    expect(companySchema.parse({ ...valid, moitNoticeUrl: "" }).moitNoticeUrl).toBeNull();
    expect(companySchema.safeParse({ ...valid, googleReviewUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(companySchema.safeParse({ ...valid, googleReviewUrl: "http://g.page/r/x" }).success).toBe(false);
  });

  it("lists the values still marked (demo)", () => {
    expect(demoFields(defaultContact)).toEqual(expect.arrayContaining(["legalName", "taxCode", "licenseNumber", "representative"]));
    expect(demoFields(applyCompany(companySchema.parse(valid)))).toEqual([]);
  });

  it("bank account: the bank name follows the BIN, and only a live account leaves demo mode", () => {
    expect(applyBank(undefined)).toBe(defaultBankTransfer);
    const bank = applyBank(bankSchema.parse({ bankBin: "970422", accountNumber: "0123456789", accountName: "CONG TY TNHH DU LICH BAC VIET", live: true }));
    expect(bank).toMatchObject({ bankName: "MB", accountNumber: "0123456789", demo: false, holdMinutes: defaultBankTransfer.holdMinutes });
    expect(bankSchema.safeParse({ bankBin: "970422", accountNumber: "0123456789", accountName: "Công ty Bắc Việt", live: true }).success).toBe(false);
    expect(bankSchema.safeParse({ bankBin: "123456", accountNumber: "0123456789", accountName: "BAC VIET", live: true }).success).toBe(false);
  });
});
