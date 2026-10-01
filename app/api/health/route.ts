import { getContainer } from "@/bootstrap/container";
import { getBuildInfo } from "@/bootstrap/env";

export const dynamic = "force-dynamic";

/** For uptime monitors: 200 when healthy, 503 when the database is unreachable. No secrets or config details. */
export async function GET(): Promise<Response> {
  const checks = await getContainer().health();
  const ok = checks.db !== "error";
  return Response.json(
    { status: ok ? "ok" : "degraded", ...getBuildInfo(), checks },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
