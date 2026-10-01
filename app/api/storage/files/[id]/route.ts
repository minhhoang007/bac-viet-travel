import { headers } from "next/headers";
import { getContainer } from "@/bootstrap/container";
import { AppError } from "@/core/errors";

/** Download: owner check, then a redirect to a short-lived presigned URL (no-store, so it is never cached). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { storage, app } = getContainer();
  if (!storage || !app) return new Response("Not found", { status: 404 });
  const user = await app.auth.getUser(await headers());
  if (!user) return new Response("Unauthorized", { status: 401 });
  try {
    const url = await storage.downloadUrl(user.id, (await params).id);
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return new Response("Not found", { status: 404 });
    throw error;
  }
}
