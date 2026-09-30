# ADR-0005: Billing with Polar (international) and VNPay (Vietnam)

- Status: **Accepted** (2026-09-30)
- Supersedes: design v2.1 §33 "no multiple payment providers at once in V1" (deliberate deviation).

## Context
Customers are both international and Vietnamese. No single provider serves both well:
Polar is a merchant of record for international cards (subscriptions, tax handled), VNPay is the domestic gateway.
They differ fundamentally: Polar renews subscriptions automatically; VNPay charges once (recurring requires a separate contract).

## Decision
1. **One access model: time-bounded grants** (`access_grants`). A user's plan is the best plan among grants active now;
   `endsAt` is the end of the contiguous chain of grants for that plan.
   - Polar subscription → one grant per subscription, `endsAt` moved to `current_period_end` on every event.
   - VNPay → buy exactly one period (30 or 365 days); purchases stack after the current end; no automatic charge.
   - Manual grants (admin, later).
   Product code asks only `entitlements.can(user, key)` / `getLimit` — never which provider paid.
2. **Polar webhooks** go through a state machine (`webhook_events`: received → processing → processed/failed/dead):
   verify signature on the raw body (official SDK: handles both signing schemes, see below), store + enqueue a job
   in one transaction, respond 202, process right after the response (`after()`), sweeper + daily reconcile as safety net.
   Out-of-order safety: a snapshot older than the stored `provider_updated_at` never overwrites.
3. **VNPay IPN** is processed synchronously (VNPay needs an `RspCode`): verify HMAC-SHA512 + TmnCode → order exists
   (`01`) → amount matches (`04`) → not already confirmed (`02`) → mark paid and grant in one transaction (`00`).
   The return URL page only displays the verified status; it never grants access.
4. **Money** in integer minor units: USD cents, VND đồng. VNPay `vnp_Amount` = đồng × 100.
5. **Account deletion** revokes live Polar subscriptions first; if the provider call fails, the deletion is aborted.
   Orders and subscriptions are kept for accounting with `owner_id` set to null.
6. **Webhook signing schemes (Polar):** secrets created on/after 2026-09-08 use Standard Webhooks as-is; older ones use
   Polar HMAC. We rely on `@polar-sh/sdk` `webhooks.validateEvent`, which handles both.

## Consequences
- Two provider integrations to maintain; each can be disabled via `config/billing.ts` `providers`.
- VNPay users renew manually (the billing page shows the end date). Tax invoices (hóa đơn VAT) for VNPay sales are the
  merchant's responsibility and are out of scope.
- End-to-end payments with real money were not run; tests use signed simulated traffic. Before going live, run one
  sandbox purchase per provider (docs/DEPLOY.md).
