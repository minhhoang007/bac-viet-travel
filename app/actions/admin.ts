"use server";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireFreshSecondFactor } from "@/app/_lib/admin";
import { localePath } from "@/core/i18n/routing";
import { ROLES } from "@/core/users/schema";

const locale = z.enum(["vi", "en"]).catch("vi");
const uuid = z.uuid();

/** Thin actions: admin guard → validate → module call (audited) → back to the page with a result flag. */
async function run(formData: FormData, back: string, action: (ctx: Awaited<ReturnType<typeof requireAdmin>>, id: string) => Promise<boolean>, options: { sensitive?: boolean } = {}) {
  const ctx = await requireAdmin();
  const l = locale.parse(formData.get("locale"));
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) notFound();
  // Account access changes: a second factor within the last minutes (step-up).
  if (options.sensitive) await requireFreshSecondFactor(back.replace(":id", id.data));
  let ok = false;
  try {
    ok = await action(ctx, id.data);
  } catch (error) {
    unstable_rethrow(error); // notFound() from a disabled module
    ctx.container.logger.warn("admin.action_failed", { error });
  }
  redirect(localePath(l, `${back.replace(":id", id.data)}?result=${ok ? "done" : "failed"}`));
}

export async function setUserStatus(formData: FormData): Promise<void> {
  const status = z.enum(["active", "disabled"]).parse(formData.get("status"));
  await run(formData, "/admin/users/:id", async ({ admin, user }, id) => {
    await admin.setUserStatus(user, id, status);
    return true;
  }, { sensitive: true });
}

export async function setUserRole(formData: FormData): Promise<void> {
  const role = z.enum(ROLES).parse(formData.get("role"));
  await run(formData, "/admin/users/:id", async ({ admin, user }, id) => {
    await admin.setUserRole(user, id, role);
    return true;
  }, { sensitive: true });
}

export async function retryJob(formData: FormData): Promise<void> {
  await run(formData, "/admin/jobs", async ({ admin, user, container }, id) => {
    if (!container.jobs) notFound();
    const jobs = container.jobs;
    return admin.audited(user, { action: "job.retry", targetType: "job", targetId: id }, () => jobs.retry(id));
  });
}

export async function retryWebhookEvent(formData: FormData): Promise<void> {
  await run(formData, "/admin/billing", async ({ admin, user, container }, id) => {
    if (!container.billing) notFound();
    const billing = container.billing;
    return admin.audited(user, { action: "webhook.retry", targetType: "webhook_event", targetId: id }, () => billing.retryWebhookEvent(id));
  });
}
