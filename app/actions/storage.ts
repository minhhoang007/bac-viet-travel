"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContainer } from "@/bootstrap/container";
import { currentUser } from "@/app/_lib/session";
import { AppError } from "@/core/errors";

export type UploadError = "type" | "size" | "quota" | "failed";
export type RequestUploadResult = { ok: true; fileId: string; url: string; headers: Record<string, string> } | { ok: false; error: UploadError };

const uploadInput = z.object({ name: z.string().min(1).max(500), contentType: z.string().min(1).max(200), size: z.number().int().positive() });

async function context() {
  const { storage } = getContainer();
  if (!storage) notFound();
  const { user } = await currentUser();
  if (!user) throw new AppError("AUTH_ERROR");
  return { storage, user };
}

const errorOf = (error: unknown): UploadError => {
  if (error instanceof AppError && error.code === "QUOTA_EXCEEDED") return "quota";
  if (error instanceof AppError && error.code === "VALIDATION_ERROR") return /large/i.test(error.message) ? "size" : "type";
  return "failed";
};

/** Step 1: validate and reserve; the browser then PUTs the file to the returned URL. */
export async function requestUpload(input: z.input<typeof uploadInput>): Promise<RequestUploadResult> {
  const { storage, user } = await context();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };
  try {
    return { ok: true, ...(await storage.requestUpload(user.id, parsed.data)) };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

/** Step 2: after the browser upload. */
export async function confirmUpload(fileId: string): Promise<{ ok: boolean }> {
  const { storage, user } = await context();
  try {
    await storage.confirmUpload(user.id, z.uuid().parse(fileId));
    revalidatePath("/[locale]/dashboard/files", "page");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function deleteFile(formData: FormData): Promise<void> {
  const { storage, user } = await context();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();
  await storage.remove(user.id, id.data);
  revalidatePath("/[locale]/dashboard/files", "page");
}
