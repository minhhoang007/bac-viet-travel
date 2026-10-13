"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireFreshSecondFactor } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import { COMPANY_CACHE_TAG, companySchema } from "@/product/company/settings";

const locale = z.enum(["vi", "en"]).catch("vi");
const BACK = "/admin/company";

async function save(formData: FormData, kind: "company" | "bank"): Promise<never> {
  const { container, user } = await requireAdmin();
  // Site-wide, and the bank account is where guests send money: verify again if the second factor is not fresh.
  await requireFreshSecondFactor(BACK);
  const service = container.app!.product.company;
  let result = "failed";
  try {
    const ok =
      kind === "company"
        ? await service.setCompany(user, Object.fromEntries(Object.keys(companySchema.shape).map((k) => [k, String(formData.get(k) ?? "")])))
        : await service.setBank(user, {
            bankBin: String(formData.get("bankBin") ?? ""),
            accountNumber: String(formData.get("accountNumber") ?? "").replace(/\s/g, ""),
            accountName: String(formData.get("accountName") ?? ""),
            live: formData.get("live") === "on",
          });
    if (ok) {
      revalidateTag(COMPANY_CACHE_TAG, { expire: 0 });
      revalidatePath("/", "layout");
    }
    result = ok ? "done" : "invalid";
  } catch (error) {
    unstable_rethrow(error);
    container.logger.warn("company_admin.save_failed", { kind, error });
  }
  redirect(localePath(locale.parse(formData.get("locale")), `${BACK}?result=${result}#${kind}`));
}

/** Admins only: company details shown across the site. */
export async function saveCompany(formData: FormData): Promise<void> {
  await save(formData, "company");
}

/** Admins only: the account guests transfer deposits to. */
export async function saveBank(formData: FormData): Promise<void> {
  await save(formData, "bank");
}
