// Starter-owned. Projects override in config/billing.ts (ADR-0004, ADR-0005).
// Money is stored as integers in minor units: USD cents, VND đồng (VND has no minor unit).

export type PlanId = "free" | "pro";
export type BillingInterval = "month" | "year";
export type BillingProviderId = "polar" | "vnpay";

/** Entitlement keys: `<domain>.<feature>[.<period>]`. boolean = allowed, number = limit (unit in the name). */
export interface Entitlements {
  "app.pro_features": boolean;
  "notes.max": number;
  "storage.max_bytes": number;
}
export type EntitlementKey = keyof Entitlements;

export interface PlanDefinition {
  name: Record<"vi" | "en", string>;
  entitlements: Entitlements;
  /** Prices shown on the pricing page. Polar charges from its product catalogue; VNPay charges exactly these. */
  prices?: {
    usd: Record<BillingInterval, number>; // cents, via Polar
    vnd: Record<BillingInterval, number>; // đồng, via VNPay
  };
}

export const billingDefaults = {
  /** Enabled payment providers. Polar: international subscriptions. VNPay: one-time purchase of a period (Vietnam). */
  providers: ["polar", "vnpay"] as BillingProviderId[],
  plans: {
    free: {
      name: { vi: "Miễn phí", en: "Free" },
      entitlements: { "app.pro_features": false, "notes.max": 20, "storage.max_bytes": 100 * 1024 * 1024 },
    },
    pro: {
      name: { vi: "Pro", en: "Pro" },
      entitlements: { "app.pro_features": true, "notes.max": 10_000, "storage.max_bytes": 10 * 1024 * 1024 * 1024 },
      prices: {
        usd: { month: 900, year: 9_000 },
        vnd: { month: 199_000, year: 1_990_000 },
      },
    },
  } satisfies Record<PlanId, PlanDefinition> as Record<PlanId, PlanDefinition>,
  /** Days a VNPay purchase grants per interval. */
  periodDays: { month: 30, year: 365 } as Record<BillingInterval, number>,
};
