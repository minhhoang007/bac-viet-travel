import { defineModule } from "@/core/module";

export const billingModule = defineModule({
  name: "billing",
  profiles: ["app"],
  requires: ["entitlements", "jobs"],
  uses: ["email"],
  // Provider credentials depend on config/billing.ts `providers` and are checked in bootstrap/env.ts.
  nav: [{ label: { vi: "Thanh toán", en: "Billing" }, href: "/dashboard/billing" }],
});
