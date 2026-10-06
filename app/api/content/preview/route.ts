import { draftMode, headers } from "next/headers";
import { allContentTypes, getContainer } from "@/bootstrap/container";
import { hasRole } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
import { appConfig } from "@/config/app";

/**
 * Draft Mode preview (staff only): GET ?id=<item>&locale=vi turns Draft Mode on and opens the item's public page,
 * which then reads the working copy (`content.getBySlug(type, slug, { draft: true })`). ?exit=1 turns it off.
 */
export async function GET(request: Request): Promise<Response> {
  const { content, app } = getContainer();
  if (!content || !app) return new Response("Not found", { status: 404 });
  const user = await app.auth.getUser(await headers());
  if (!user || !hasRole(user, "editor")) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const locale = (appConfig.locales as readonly string[]).includes(url.searchParams.get("locale") ?? "") ? url.searchParams.get("locale")! : appConfig.defaultLocale;
  const mode = await draftMode();
  if (url.searchParams.has("exit")) {
    mode.disable();
    return redirect(localePath(locale, "/admin/content"));
  }
  const item = await content.get(url.searchParams.get("id") ?? "");
  const type = item && allContentTypes()[item.type];
  if (!item || !type) return new Response("Not found", { status: 404 });
  mode.enable();
  return redirect(localePath(locale, type.publicPath(item.slug)));
}

const redirect = (location: string) => new Response(null, { status: 307, headers: { location, "cache-control": "no-store" } });
