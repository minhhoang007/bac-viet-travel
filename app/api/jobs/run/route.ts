import { timingSafeEqual } from "node:crypto";
import { getContainer } from "@/bootstrap/container";
import { getEnv } from "@/bootstrap/env";

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET` (vercel.json, ADR-0002).
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request): Promise<Response> {
  const { jobs, logger } = getContainer();
  if (!jobs) return new Response("Not found", { status: 404 }); // jobs module off
  if (!authorized(request, getEnv().extra.CRON_SECRET!)) return new Response("Unauthorized", { status: 401 });

  // Periodic tasks (sweepers, reconcile) + due jobs, within about a third of the function limit.
  const result = await jobs.tick({ budgetMs: 20_000 });
  logger.info("jobs.tick", { ...result });
  return Response.json(result);
}

export { handle as GET, handle as POST };
