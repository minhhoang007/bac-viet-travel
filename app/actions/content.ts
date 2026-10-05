"use server";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/app/_lib/admin";
import { AppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import { zonedToUtc } from "@/core/i18n/time-zone";
import { appConfig } from "@/config/app";
import type { ContentItem, ContentModule } from "@/modules/content";

const locale = z.enum(["vi", "en"]).catch("vi");
const uuid = z.uuid();
const revision = z.coerce.number().int().positive();
// Back to the page the panel sits on; only admin paths (no open redirect).
const returnTo = z.string().regex(/^\/admin(?:\/[\w-]+)*$/).catch("/admin/content");

type Role = "editor" | "admin";

/**
 * Shared runner for the workflow panel's forms: staff guard, input, audit (admin actions), result in the URL.
 * `?result=done|conflict|failed` is shown by the panel.
 */
async function run(formData: FormData, role: Role, action: string, step: (content: ContentModule, actor: { id: string }, id: string, rev: number) => Promise<ContentItem | void>) {
  const { user, container } = await requireStaff(role);
  const content = container.content;
  if (!content) notFound();
  const l = locale.parse(formData.get("locale"));
  const back = returnTo.parse(formData.get("returnTo"));
  const id = uuid.parse(formData.get("id"));
  const rev = revision.parse(formData.get("revision"));
  let result = "done";
  try {
    const work = async () => {
      await step(content, user, id, rev);
      return true;
    };
    if (role === "admin" && container.admin) await container.admin.audited(user, { action: `content.${action}`, targetType: "content", targetId: id }, work);
    else await work();
  } catch (error) {
    unstable_rethrow(error);
    result = error instanceof AppError && error.code === "CONFLICT" ? "conflict" : "failed";
    if (result === "failed") container.logger.warn("content.action_failed", { action, id, error });
  }
  redirect(localePath(l, `${back}?result=${result}`));
}

export async function submitContent(formData: FormData): Promise<void> {
  await run(formData, "editor", "submit", (c, actor, id, rev) => c.submit(actor, id, rev));
}

export async function approveContent(formData: FormData): Promise<void> {
  const at = String(formData.get("publishAt") ?? "");
  const publishAt = at ? zonedToUtc(at, appConfig.timeZone) : undefined;
  await run(formData, "admin", at ? "schedule" : "publish", async (c, actor, id, rev) => {
    // A schedule that does not parse must fail, never fall through to "publish now".
    if (at && !publishAt) throw new AppError("VALIDATION_ERROR", "Invalid publish time");
    return c.approve(actor, id, { revision: rev, publishAt: publishAt ?? undefined });
  });
}

export async function rejectContent(formData: FormData): Promise<void> {
  const note = String(formData.get("note") ?? "");
  await run(formData, "admin", "reject", (c, actor, id, rev) => c.reject(actor, id, { revision: rev, note }));
}

export async function setContentHidden(formData: FormData): Promise<void> {
  const hidden = formData.get("hidden") === "true";
  await run(formData, "admin", hidden ? "hide" : "show", (c, actor, id, rev) => c.setHidden(actor, id, { revision: rev, hidden }));
}

export async function restoreContent(formData: FormData): Promise<void> {
  const versionId = uuid.catch("").parse(formData.get("versionId"));
  await run(formData, "editor", "restore", (c, actor, id, rev) => c.restore(actor, id, { revision: rev, versionId }));
}
