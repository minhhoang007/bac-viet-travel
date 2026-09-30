import { getContainer } from "@/bootstrap/container";

/** GET: download the signed-in user's data as JSON. */
export async function GET(request: Request): Promise<Response> {
  const { app } = getContainer();
  if (!app) return new Response("Not found", { status: 404 });

  const user = await app.auth.getUser(request.headers);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const data = await app.account.exportAccount(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="account-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
