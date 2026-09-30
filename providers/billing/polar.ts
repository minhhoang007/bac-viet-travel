import { createPolar, webhooks } from "@polar-sh/sdk/2026-10";
import { WebhookSignatureError, type ProviderSubscription, type SubscriptionProvider } from "@/modules/billing";

interface PolarSubscriptionLike {
  id: string;
  status: string;
  product_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  ended_at: string | null;
  created_at: string;
  modified_at: string | null;
  customer?: { external_id?: string | null } | null;
}

export function normalizeSubscription(s: PolarSubscriptionLike): ProviderSubscription {
  return {
    id: s.id,
    status: s.status,
    productId: s.product_id,
    currentPeriodEnd: s.current_period_end,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    endedAt: s.ended_at,
    externalCustomerId: s.customer?.external_id ?? null,
    updatedAt: s.modified_at ?? s.created_at,
  };
}

/** Polar adapter. Webhook verification uses the official SDK (handles both signing schemes, see ADR-0005). */
export function polarProvider(options: {
  accessToken: string;
  webhookSecret: string;
  server: "sandbox" | "production";
}): SubscriptionProvider {
  let client: ReturnType<typeof createPolar> | undefined;
  const polar = () => (client ??= createPolar({ accessToken: options.accessToken, environment: options.server, timeout: 15 }));

  return {
    async verifyWebhook(body, headers) {
      let event: Awaited<ReturnType<typeof webhooks.validateEvent>>;
      try {
        event = await webhooks.validateEvent(
          body,
          {
            "webhook-id": headers.get("webhook-id") ?? "",
            "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
            "webhook-signature": headers.get("webhook-signature") ?? "",
          },
          options.webhookSecret,
        );
      } catch (error) {
        if (error instanceof webhooks.PolarWebhookVerificationError) throw new WebhookSignatureError();
        throw error;
      }
      const data = (event as { data?: unknown }).data;
      return {
        id: headers.get("webhook-id") ?? "",
        type: event.type,
        timestamp: event.timestamp,
        payload: JSON.parse(body) as Record<string, unknown>,
        subscription: event.type.startsWith("subscription.") ? normalizeSubscription(data as PolarSubscriptionLike) : undefined,
      };
    },

    async createCheckout({ productId, userId, email, successUrl }) {
      const checkout = await polar().checkouts.create({
        products: [productId],
        external_customer_id: userId,
        customer_email: email,
        success_url: successUrl,
      });
      return { url: checkout.url };
    },

    async createPortalSession({ userId, returnUrl }) {
      const session = await polar().customerSessions.create({ external_customer_id: userId, return_url: returnUrl });
      return { url: session.customer_portal_url };
    },

    async getSubscription(id) {
      return normalizeSubscription((await polar().subscriptions.get(id)) as unknown as PolarSubscriptionLike);
    },

    async revokeSubscription(id) {
      return normalizeSubscription((await polar().subscriptions.revoke(id)) as unknown as PolarSubscriptionLike);
    },
  };
}
