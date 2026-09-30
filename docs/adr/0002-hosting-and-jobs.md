# ADR-0002: Hosting plan and job scheduling

- Status: **Deferred** — must be Accepted before V1.1
- Date: 2026-09-30

## Context
Cron only *triggers* work; it does not remove function timeouts or replace locking/retry. Hosting plans differ in cron frequency (e.g. Vercel Hobby: roughly once per day — re-check current limits).

## Options

| Situation | Scheduler for `/api/jobs/run` |
|---|---|
| Plan with per-minute cron | Platform cron |
| Sparse cron only | External scheduler (QStash, GitHub Actions) or job service (Inngest, Trigger.dev) |
| Work longer than function timeout | Chunked/resumable handlers or a dedicated worker |

## Required frequencies (fill in)

| Job | Minimum frequency | Scheduler meets it? |
|---|---|---|
| Webhook processing | near real-time | |
| Usage / webhook sweeper | minutes | |
| Billing reconcile | hourly | |
| Email retry | minutes | |

## Decision
_TBD._ Default suggestion on Vercel Hobby: QStash calling `/api/jobs/run` with `CRON_SECRET`.
