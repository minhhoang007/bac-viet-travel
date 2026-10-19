import { draftMode, headers } from "next/headers";
import { allContentTypes, getContainer } from "@/bootstrap/container";
import { hasRole } from "@/core/auth";

/** Whether this staff member may see drafts of, and work on, items of a content type (manifest `canEdit`). */
export async function mayEditContent(user: { id: string; role: string }, type: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const canEdit = allContentTypes()[type]?.canEdit;
  return canEdit ? Boolean(await canEdit(user)) : true;
}

/**
 * Public pages read content through this: the live copy, or the working copy in Draft Mode (preview link from the
 * admin). Draft Mode counts only while the viewer is still staff allowed on this type, so a leftover cookie never
 * shows drafts.
 */
export async function readContent(type: string, slug: string): Promise<{ id: string; slug: string; data: Record<string, unknown>; preview: boolean } | null> {
  const { content, app } = getContainer();
  if (!content) return null;
  const preview = (await draftMode()).isEnabled && Boolean(app && (await staff(app, type)));
  const item = await content.getBySlug(type, slug, { draft: preview });
  // "preview" only when the working copy came back (a draft renamed away from this slug shows the live copy).
  return item && { id: item.id, slug: item.slug, data: item.data, preview: item.draft };
}

async function staff(app: NonNullable<ReturnType<typeof getContainer>["app"]>, type: string) {
  const current = await app.auth.getSession(await headers());
  // Staff who passed the second factor this session (as for the admin area).
  return current !== null && hasRole(current.user, "editor") && (await app.auth.staffGate(current)) === "ok" && (await mayEditContent(current.user, type));
}
