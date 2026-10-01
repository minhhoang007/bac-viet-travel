// Project-owned: plans, prices and enabled providers.
import { billingDefaults } from "./billing.defaults";

export const billingConfig = { ...billingDefaults };
export type BillingConfig = typeof billingConfig;
