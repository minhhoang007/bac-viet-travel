/** Normalized Polar subscription (subset the billing module needs). */
export interface ProviderSubscription {
  id: string;
  status: string;
  productId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
  /** Our user id, passed as external_customer_id at checkout. */
  externalCustomerId: string | null;
  /** Provider modification time (falls back to creation time); used for out-of-order protection. */
  updatedAt: string;
}

export interface VerifiedWebhook {
  /** Unique delivery id (Standard Webhooks `webhook-id`). */
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  /** Present for subscription.* events. */
  subscription?: ProviderSubscription;
}

export class WebhookSignatureError extends Error {
  constructor() {
    super("Invalid webhook signature");
    this.name = "WebhookSignatureError";
  }
}

export interface SubscriptionProvider {
  /** Throws WebhookSignatureError when the signature is invalid. `body` must be the raw request body. */
  verifyWebhook(body: string, headers: Headers): Promise<VerifiedWebhook>;
  createCheckout(input: { productId: string; userId: string; email: string; successUrl: string }): Promise<{ url: string }>;
  createPortalSession(input: { userId: string; returnUrl: string }): Promise<{ url: string }>;
  getSubscription(id: string): Promise<ProviderSubscription>;
  /** Ends the subscription immediately (no further charges). */
  revokeSubscription(id: string): Promise<ProviderSubscription>;
}

// Moved to core so product code can use it too (rc.10).
export type { OneTimePaymentProvider } from "@/core/ports/payments";
