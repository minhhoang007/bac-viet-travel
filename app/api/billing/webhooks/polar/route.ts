import { after } from "next/server";
import { getContainer } from "@/bootstrap/container";
import { WebhookSignatureError } from "@/modules/billing";

/**
 * Polar webhooks: verify raw body → store event + enqueue job (one transaction) → 202 fast.
 * Processing starts right after the response (after()); the daily cron sweeper is the safety net.
 */
export async function POST(request: Request): Promise<Response> {
  const { billing, jobs, logger } = getContainer();
  if (!billing?.providers.includes("polar") || !jobs) return new Response("Not found", { status: 404 });

  try {
    const { duplicate } = await billing.receivePolarWebhook(await request.text(), request.headers);
    after(async () => {
      try {
        await jobs.runDue({ budgetMs: 10_000 });
      } catch (error) {
        logger.error("billing.webhook_after_failed", { error });
      }
    });
    return Response.json({ received: true, duplicate }, { status: 202 });
  } catch (error) {
    if (error instanceof WebhookSignatureError) return new Response("Invalid signature", { status: 403 });
    logger.error("billing.webhook_receive_failed", { error: error instanceof Error ? error.message : "unknown" });
    return new Response("Error", { status: 500 }); // Polar retries with backoff
  }
}
