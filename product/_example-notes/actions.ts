"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/app/_lib/session";
import { isAppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";

export type NoteFormState = { status: "error"; field?: "title" | "body"; code: "required" | "too_long" | "error" } | null;

const localeSchema = z.enum(["vi", "en"]).catch("vi");
const NOTES_PATH = "/dashboard/product/notes";

/** Thin actions: session → service (validation + ownerId scoping live in the service). */
async function run(formData: FormData, work: (userId: string) => Promise<unknown>): Promise<NoteFormState> {
  const { user } = await currentUser();
  const locale = localeSchema.parse(formData.get("locale"));
  if (!user) redirect(localePath(locale, "/login"));
  try {
    await work(user.id);
  } catch (error) {
    if (isAppError(error) && error.code === "VALIDATION_ERROR") {
      const issue = (error.details?.issues as { path: string; code: string }[] | undefined)?.[0];
      const code = issue?.code === "too_long" ? "too_long" : "required";
      return { status: "error", field: issue?.path === "body" ? "body" : "title", code };
    }
    if (isAppError(error) && error.code === "NOT_FOUND") redirect(localePath(locale, NOTES_PATH));
    return { status: "error", code: "error" };
  }
  revalidatePath("/[locale]/dashboard/product/notes", "page");
  redirect(localePath(locale, NOTES_PATH));
}

const fields = (formData: FormData) => ({ title: formData.get("title"), body: formData.get("body") ?? "" });

export async function createNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const { app } = await currentUser();
  return run(formData, (userId) => app.product.notes.create(userId, fields(formData)));
}

export async function updateNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const { app } = await currentUser();
  return run(formData, (userId) => app.product.notes.update(userId, String(formData.get("id")), fields(formData)));
}

export async function deleteNote(formData: FormData): Promise<void> {
  const { app } = await currentUser();
  await run(formData, (userId) => app.product.notes.remove(userId, String(formData.get("id"))));
}
