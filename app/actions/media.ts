"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/app/_lib/admin";
import { AppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";

export type MediaUploadError = "format" | "size" | "failed";

const locale = z.enum(["vi", "en"]).catch("vi");
const uuid = z.uuid();

/** Media module on + staff (editor or admin): content editors manage the library. */
async function context() {
  const ctx = await requireStaff("editor");
  if (!ctx.container.media) notFound();
  return { ...ctx, media: ctx.container.media };
}

/** Step 1: reserve and sign; the browser then posts the file straight to the media provider. */
export async function requestMediaUpload(name: string): Promise<{ ok: true; id: string; url: string; fields: Record<string, string> } | { ok: false }> {
  const { media, user } = await context();
  const parsed = z.string().min(1).max(500).safeParse(name);
  if (!parsed.success) return { ok: false };
  return { ok: true, ...(await media.requestUpload(user, { name: parsed.data })) };
}

/** Step 2: after the browser upload, the server checks what the provider actually stored. */
export async function confirmMediaUpload(id: string): Promise<{ ok: true } | { ok: false; error: MediaUploadError }> {
  const { media } = await context();
  try {
    await media.confirmUpload(uuid.parse(id));
    revalidatePath("/[locale]/admin/media", "page");
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError && error.code === "VALIDATION_ERROR") return { ok: false, error: /large/i.test(error.message) ? "size" : /type/i.test(error.message) ? "format" : "failed" };
    return { ok: false, error: "failed" };
  }
}

export async function updateMedia(formData: FormData): Promise<void> {
  const { media, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const id = uuid.parse(formData.get("id"));
  const num = (key: string) => {
    const n = Number(formData.get(key));
    return Number.isFinite(n) ? n : undefined;
  };
  let ok = false;
  try {
    await media.update(id, { alt: { vi: String(formData.get("alt_vi") ?? ""), en: String(formData.get("alt_en") ?? "") }, focalX: num("focalX"), focalY: num("focalY") });
    ok = true;
  } catch (error) {
    unstable_rethrow(error);
    container.logger.warn("media.update_failed", { error });
  }
  redirect(localePath(l, `/admin/media/${id}?result=${ok ? "done" : "failed"}`));
}

export async function deleteMedia(formData: FormData): Promise<void> {
  const { media, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const id = uuid.parse(formData.get("id"));
  try {
    await media.remove(id);
  } catch (error) {
    unstable_rethrow(error);
    const code = error instanceof AppError && error.code === "CONFLICT" ? "in_use" : "failed";
    if (code === "failed") container.logger.warn("media.delete_failed", { error });
    redirect(localePath(l, `/admin/media/${id}?result=${code}`));
  }
  revalidatePath("/[locale]/admin/media", "page");
  redirect(localePath(l, "/admin/media?result=done"));
}
