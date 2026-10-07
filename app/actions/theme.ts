"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import { isThemeMode, isThemeName, THEME_CACHE_TAG } from "@/product/theme/themes";

const locale = z.enum(["vi", "en"]).catch("vi");

/** Admins only: save the site theme, then regenerate every page with it. */
export async function saveTheme(formData: FormData): Promise<void> {
  const { container, user } = await requireAdmin();
  const theme = formData.get("theme");
  const mode = formData.get("mode");
  let result = "failed";
  if (!isThemeName(theme) || !isThemeMode(mode)) result = "invalid";
  else {
    try {
      await container.app!.product.theme.set(user, { theme, mode });
      revalidateTag(THEME_CACHE_TAG, { expire: 0 });
      revalidatePath("/", "layout");
      result = "done";
    } catch (error) {
      unstable_rethrow(error);
      container.logger.warn("theme_admin.save_failed", { error });
    }
  }
  redirect(localePath(locale.parse(formData.get("locale")), `/admin/appearance?result=${result}`));
}
