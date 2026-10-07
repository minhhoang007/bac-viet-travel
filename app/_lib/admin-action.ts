import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/core/i18n/routing";
import type { Permission } from "@/product/staff/permissions";
import { requirePermission } from "./staff";

export type AdminContext = Awaited<ReturnType<typeof requirePermission>>;

const locale = z.enum(["vi", "en"]).catch("vi");

/**
 * Thin product admin action: staff permission guard (admins always pass) → `work` → back to `back` with `result=<what work returned>` (it may append
 * more params, e.g. "invalid&field=code"). A thrown error is logged under `event` and gives result=failed; Next's
 * redirect/notFound pass through.
 */
export async function adminAction(formData: FormData, back: string, event: string, permission: Permission, work: (ctx: AdminContext) => Promise<string>): Promise<never> {
  const ctx = await requirePermission(permission);
  let result = "failed";
  try {
    result = await work(ctx);
  } catch (error) {
    unstable_rethrow(error);
    ctx.container.logger.warn(event, { error });
  }
  redirect(localePath(locale.parse(formData.get("locale")), `${back}${back.includes("?") ? "&" : "?"}result=${result}`));
}
