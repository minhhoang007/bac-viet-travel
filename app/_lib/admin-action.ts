import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/core/i18n/routing";
import { requireAdmin } from "./admin";

export type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;

const locale = z.enum(["vi", "en"]).catch("vi");

/**
 * Thin product admin action: admin guard → `work` → back to `back` with `result=<what work returned>` (it may append
 * more params, e.g. "invalid&field=code"). A thrown error is logged under `event` and gives result=failed; Next's
 * redirect/notFound pass through.
 */
export async function adminAction(formData: FormData, back: string, event: string, work: (ctx: AdminContext) => Promise<string>): Promise<never> {
  const ctx = await requireAdmin();
  let result = "failed";
  try {
    result = await work(ctx);
  } catch (error) {
    unstable_rethrow(error);
    ctx.container.logger.warn(event, { error });
  }
  redirect(localePath(locale.parse(formData.get("locale")), `${back}${back.includes("?") ? "&" : "?"}result=${result}`));
}
