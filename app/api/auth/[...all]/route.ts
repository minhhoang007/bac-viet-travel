import { getContainer } from "@/bootstrap/container";

// Better Auth endpoints. 404 in profile "site" (no DB, no auth).
async function handle(request: Request): Promise<Response> {
  const { app } = getContainer();
  if (!app) return new Response("Not found", { status: 404 });
  return app.auth.handler(request);
}

export { handle as GET, handle as POST };
