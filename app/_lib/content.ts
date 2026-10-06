import { draftMode, headers } from "next/headers";
import { getContainer } from "@/bootstrap/container";
import { hasRole } from "@/core/auth";

/**
 * Public pages read content through this: the live copy, or the working copy in Draft Mode (preview link from the
 * admin). Draft Mode counts only while the viewer is still staff, so a leftover cookie never shows drafts.
 */
export async function readContent(type: string, slug: string): Promise<{ id: string; slug: string; data: Record<string, unknown>; preview: boolean } | null> {
  const { content, app } = getContainer();
  if (!content) return null;
  const preview = (await draftMode()).isEnabled && Boolean(app && (await staff(app)));
  const item = await content.getBySlug(type, slug, { draft: preview });
  // "preview" only when the working copy came back (a draft renamed away from this slug shows the live copy).
  return item && { id: item.id, slug: item.slug, data: item.data, preview: item.draft };
}

async function staff(app: NonNullable<ReturnType<typeof getContainer>["app"]>) {
  const user = await app.auth.getUser(await headers());
  return user !== null && hasRole(user, "editor");
}
