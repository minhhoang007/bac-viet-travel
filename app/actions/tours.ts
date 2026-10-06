"use server";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/app/_lib/admin";
import { AppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import { tourDraftSchema } from "@/product/tours/document";
import { TOUR_CONTENT_TYPE } from "@/product/tours/source";

const locale = z.enum(["vi", "en"]).catch("vi");
const uuid = z.uuid();
const revision = z.coerce.number().int().positive();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TABS = ["general", "vi", "en", "seo", "images", "private"] as const;

/** Editors and admins; the content module must be on. */
async function context() {
  const ctx = await requireStaff("editor");
  if (!ctx.container.content) notFound();
  return { ...ctx, content: ctx.container.content };
}

const resultOf = (error: unknown) =>
  error instanceof AppError && error.code === "CONFLICT" ? (/slug/i.test(error.message) ? "slug_taken" : "conflict") : error instanceof AppError && error.code === "VALIDATION_ERROR" ? "invalid" : "failed";

export async function createTour(formData: FormData): Promise<void> {
  const { content, user, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const title = String(formData.get("titleVi") ?? "").trim().slice(0, 120);
  let target = `/admin/tours/new?result=invalid`;
  if (SLUG.test(slug) && title) {
    try {
      const item = await content.create(user, { type: TOUR_CONTENT_TYPE, slug, data: { shared: { images: [] }, vi: { title }, en: {} } });
      target = `/admin/tours/${item.id}?result=created`;
    } catch (error) {
      unstable_rethrow(error);
      const result = resultOf(error);
      if (result === "failed") container.logger.warn("tours.create_failed", { error });
      target = `/admin/tours/new?result=${result}`;
    }
  }
  redirect(localePath(l, target));
}

export async function duplicateTour(formData: FormData): Promise<void> {
  const { content, user, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const source = await content.get(uuid.catch("").parse(formData.get("id")));
  if (!source || source.type !== TOUR_CONTENT_TYPE) notFound();
  const taken = new Set((await content.list({ type: TOUR_CONTENT_TYPE, pageSize: 100 })).rows.flatMap((r) => [r.slug, r.publishedSlug ?? ""]));
  let slug = `${source.slug}-copy`.slice(0, 110);
  for (let n = 2; taken.has(slug); n++) slug = `${source.slug}-copy-${n}`.slice(0, 110);
  let target = `/admin/tours?result=failed`;
  try {
    const item = await content.create(user, { type: TOUR_CONTENT_TYPE, slug, data: source.draft });
    target = `/admin/tours/${item.id}?result=duplicated`;
  } catch (error) {
    unstable_rethrow(error);
    container.logger.warn("tours.duplicate_failed", { error });
  }
  redirect(localePath(l, target));
}

/** Saves the working copy (incomplete is fine). A new slug of a live tour applies on publish; the old URL then redirects. */
export async function saveTour(formData: FormData): Promise<void> {
  const { content, user, container } = await context();
  const l = locale.parse(formData.get("locale"));
  const id = uuid.parse(formData.get("id"));
  const tab = z.enum(TABS).catch("general").parse(formData.get("tab"));
  const item = await content.get(id);
  if (!item || item.type !== TOUR_CONTENT_TYPE) notFound();
  let result = "saved";
  try {
    const data = tourDraftSchema.parse(JSON.parse(String(formData.get("data") ?? "{}")));
    const slug = String(formData.get("slug") ?? item.slug).trim().toLowerCase();
    await content.saveDraft(user, id, { revision: revision.parse(formData.get("revision")), slug, data });
  } catch (error) {
    unstable_rethrow(error);
    result = error instanceof SyntaxError || error instanceof z.ZodError ? "invalid" : resultOf(error);
    if (result === "failed") container.logger.warn("tours.save_failed", { id, error });
  }
  redirect(localePath(l, `/admin/tours/${id}?tab=${tab}&result=${result}`));
}
