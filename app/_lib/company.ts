import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getContainer } from "@/bootstrap/container";
import { defaultBankTransfer as bankTransferConfig } from "@/config/bank-transfer";
import { defaultContact as contactConfig } from "@/config/contact";
import { COMPANY_CACHE_TAG, type BankTransfer, type Company } from "@/product/company/settings";

type Settings = { company: Company; bank: BankTransfer };
const DEFAULTS: Settings = { company: contactConfig, bank: bankTransferConfig };

const load = unstable_cache(async (): Promise<Settings> => (await getContainer().app?.product.company.get()) ?? DEFAULTS, ["site-company"], { tags: [COMPANY_CACHE_TAG] });
const fallbackTag = unstable_cache(async () => true, ["site-company:fallback"], { tags: [COMPANY_CACHE_TAG] });

/**
 * Company details and bank account (Admin → Thông tin công ty), from the data cache so static pages stay static;
 * saving revalidates COMPANY_CACHE_TAG. A build without a database, or a failing read, uses config/contact.ts and
 * config/bank-transfer.ts (still through a tagged entry, so the next save regenerates the page).
 */
const settings = cache(async (): Promise<Settings> => {
  try {
    getContainer();
  } catch {
    await fallbackTag();
    return DEFAULTS;
  }
  try {
    return await load();
  } catch {
    await fallbackTag();
    return DEFAULTS;
  }
});

export const currentCompany = async (): Promise<Company> => (await settings()).company;
export const currentBank = async (): Promise<BankTransfer> => (await settings()).bank;
