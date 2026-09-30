---
name: tdd-critical-flows
description: Test-first workflow and required failure-path scenarios for auth, IDOR, webhooks, jobs, usage and module-off behavior. Use when implementing or changing any of these flows.
---

# TDD for critical flows

## Loop
1. Write the failing test that expresses the requirement (or reproduces the bug).
2. Run it; confirm it fails for the right reason.
3. Minimal code to pass.
4. Refactor with tests green. Run `pnpm check`.

Integration tests use a **real Postgres** (CI service / Testcontainers). Concurrency tests must run truly parallel
transactions (`Promise.all` over separate connections), not sequential calls.

## Required scenarios

**Auth / authorization**
- signup, login, logout, protected route redirect
- role check (`user` vs `admin`)
- IDOR: B cannot read/update/delete A's data
- account linking refused for unverified email / untrusted provider

**Module off**
- no secrets needed, build OK, endpoints 404, jobs not registered

**Webhooks**
- valid signature accepted, invalid → 400
- duplicate event processed once
- duplicate of a not-yet-processed event still gets a job
- out-of-order events do not corrupt state
- crash after store → sweeper completes it (never stuck in `received`)
- exceeding maxAttempts → `dead`

**Jobs**
- N workers claiming in parallel → no job runs twice
- expired lease → re-claimed
- backoff retry, then `dead`

**Usage**
- parallel reserves never exceed the limit
- duplicate idempotencyKey does not double count
- commit adjusts by actual − reserved; commit/release idempotent
- expired reservation without `executionStartedAt` → released; with it → `unknown`
- streaming disconnect commits the used portion

## Anti-patterns
- Mocking the database in concurrency or transaction tests.
- Asserting only the happy path.
- Tests that pass when the feature is deleted.
