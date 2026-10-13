import { inArray } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { ProductContext } from "@/core/product/context";
import type { Db } from "@/db/client";
import { siteSettings } from "../schema/settings";
import { applyBank, applyCompany, bankSchema, companySchema, type BankTransfer, type Company } from "./settings";

type Actor = Parameters<NonNullable<ProductContext["audit"]>["audited"]>[0];

export interface CompanyService {
  /** Company details and bank account: saved values over config/contact.ts and config/bank-transfer.ts. */
  get(): Promise<{ company: Company; bank: BankTransfer }>;
  /** Save the company details. Audited. False when a value is invalid. */
  setCompany(actor: Actor, raw: Record<string, unknown>): Promise<boolean>;
  /** Save the account guests transfer deposits to. Audited with the new account (not secret: guests see it). */
  setBank(actor: Actor, raw: Record<string, unknown>): Promise<boolean>;
}

/** The caller regenerates the pages afterwards (COMPANY_CACHE_TAG): app/actions/company.ts. */
export function createCompanyService(deps: { db: Db; audit?: ProductContext["audit"] }): CompanyService {
  const { db } = deps;

  const save = async (actor: Actor, key: "company" | "bank", value: Record<string, unknown>) => {
    if (!deps.audit) throw new AppError("MODULE_DISABLED", "Admin module is off");
    await deps.audit.audited(actor, { action: `settings.${key}`, targetType: "setting", targetId: key, metadata: key === "bank" ? value : { fields: Object.keys(value) } }, async () => {
      await db.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
      return true;
    });
  };

  return {
    async get() {
      const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings).where(inArray(siteSettings.key, ["company", "bank"]));
      const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { company: applyCompany(stored.company), bank: applyBank(stored.bank) };
    },

    async setCompany(actor, raw) {
      const parsed = companySchema.safeParse(raw);
      if (!parsed.success) return false;
      await save(actor, "company", parsed.data);
      return true;
    },

    async setBank(actor, raw) {
      const parsed = bankSchema.safeParse(raw);
      if (!parsed.success) return false;
      await save(actor, "bank", parsed.data);
      return true;
    },
  };
}
