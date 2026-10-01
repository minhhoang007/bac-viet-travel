# ADR-0002: Hosting plan and job scheduling

- Status: **Accepted** (2026-09-30)
- Date: 2026-09-30

## Context
Cron only *triggers* work; it does not remove function timeouts or replace locking/retry.
Hosting: **Vercel**. The Hobby plan runs cron jobs about once per day (verify current limits before relying on them).

## Decision
1. **Jobs table + worker** (`modules/jobs`): atomic claim with `FOR UPDATE SKIP LOCKED`, lease (`locked_until`),
   retry with exponential backoff (30 s → 1 h), `dead` after `max_attempts`, idempotent enqueue via `dedupe_key`.
2. **Near-real-time work does not wait for cron.** Webhook routes store + enqueue, respond, then run due jobs in
   `after()`. Email sends directly and only queues a retry on failure.
3. **Vercel Cron** (`vercel.json`) calls `GET /api/jobs/run` daily with `Authorization: Bearer $CRON_SECRET`:
   purge finished jobs, re-queue stale webhook events, reconcile subscriptions with Polar, run due jobs
   (20 s budget, `maxDuration` 60 s).
4. **Scaling up without code changes:** Vercel Pro (cron every minute) or an external scheduler (QStash, GitHub Actions)
   calling the same endpoint with the same secret.

## Required frequencies

| Job | Needed | Met by |
|---|---|---|
| Webhook processing | near real-time | `after()` on receipt |
| Email retry | minutes–hours | next `after()`/cron run (daily on Hobby) |
| Webhook sweeper | daily acceptable (rare) | cron |
| Billing reconcile | daily | cron |

On Hobby, a failed email retry or a webhook whose `after()` failed waits until the next daily run. If that is not
acceptable for a project, use Vercel Pro or QStash (every 5 minutes).
