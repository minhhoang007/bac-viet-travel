"use server";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/app/_lib/admin";
import { POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { AppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import { appConfig } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

const locale = z.enum(["vi", "en"]).catch("vi");
const uuid = z.uuid();
const revision = z.coerce.number().int().positive();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Editors and admins; only when the blog reads posts from the content module. */
async function context() {
  const ctx = await requireStaff("editor");
  if (!ctx.container.content || !features.blog || blogConfig.source !== "content") notFound();
  return { ...ctx, content: ctx.container.content };
}

const resultOf = (error: unknown) =>
  error instanceof AppError && error.code === "CONFLICT" ? (/slug/i.test(error.message) ? "slug_taken" : "conflict") : error instanceof AppError && error.code === "VALIDATION_ERROR" ? "invalid" : "failed";

const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);

/**
 * Post fields from the form as stored (incomplete drafts are fine; the content type's validate() lists what is
 * missing). Empty optional fields are left out so the published post schema accepts them.
 */
function postData(formData: FormData): Record<string, unknown> {
  const postLocale = String(formData.get("postLocale") ?? "");
  const optional = (key: string, max: number) => {
    const value = text(formData, key, max);
    return value ? { [key]: value } : {};
  };
  return {
    locale: (appConfig.locales as readonly string[]).includes(postLocale) ? postLocale : appConfig.defaultLocale,
    title: text(formData, "title", 200),
    description: text(formData, "description", 300),
    date: text(formData, "date", 10),
    ...optional("updated", 10),
    tags: text(formData, "tags", 500)
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20),
    ...optional("cover", 500),
    ...optional("author", 100),
    ...optional("translationKey", 100),
    body: String(formData.get("body") ?? "").slice(0, 100_000),
  };
}

export async function createPost(formData: FormData): Promise<void> {
  const { content, user, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const slug = text(formData, "slug", 110).toLowerCase();
  let target = "/admin/posts/new?result=invalid";
  if (SLUG.test(slug) && text(formData, "title", 200)) {
    try {
      const item = await content.create(user, { type: POST_CONTENT_TYPE, slug, data: { ...postData(formData), date: new Date().toISOString().slice(0, 10) } });
      target = `/admin/posts/${item.id}?result=created`;
    } catch (error) {
      unstable_rethrow(error);
      const result = resultOf(error);
      if (result === "failed") container.logger.warn("posts.create_failed", { error });
      target = `/admin/posts/new?result=${result}`;
    }
  }
  redirect(localePath(l, target));
}

/** Saves the working copy. A new slug of a live post applies on publish; the old URL then redirects. */
export async function savePost(formData: FormData): Promise<void> {
  const { content, user, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const id = uuid.parse(formData.get("id"));
  const item = await content.get(id);
  if (!item || item.type !== POST_CONTENT_TYPE) notFound();
  let result = "saved";
  try {
    const slug = text(formData, "slug", 110).toLowerCase();
    await content.saveDraft(user, id, { revision: revision.parse(formData.get("revision")), slug, data: postData(formData) });
  } catch (error) {
    unstable_rethrow(error);
    result = error instanceof z.ZodError ? "invalid" : resultOf(error);
    if (result === "failed") container.logger.warn("posts.save_failed", { id, error });
  }
  redirect(localePath(l, `/admin/posts/${id}?result=${result}`));
}
