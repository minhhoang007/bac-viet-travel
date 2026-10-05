# Requirements

## 1. Scope table (single source; roadmap and DoD reference this)

| Component | Profile | Release | Blocks V1.0 |
|---|---|---|---|
| Core Base: config, content, UI, marketing blocks, SEO, env validation, errors, logging, basic security, CI, boundary lint | site + app | V0.1a | Yes |
| Module `email` (direct send) + contact form (validate, rate limit) | site + app | V0.1b | Yes |
| Core App: DB, auth, users, `ownerId`, account (delete/export), dashboard shell, legal pages | app | V0.2 | Yes |
| Vertical slice `product/_example-notes/` | app | V0.2 | Yes |
| `jobs`, `entitlements`, `billing`, `usage` | app | V1.1 | No |
| `admin`, `analytics`, `storage` | app (analytics: both) | V1.2 | No |
| `ai`, `blog` | app / site | V1.x | No |
| Interactive CLI | — | after V1 | No |

## 2. Out of scope for V1
Multi-tenancy, organizations, complex RBAC, team invitations, enterprise SSO, workflow engine, microservices,
Kubernetes, event bus, CRM, complex CMS, password auth, credit ledger, multiple payment providers at once.

## 3. V1.0 Definition of Done
- [x] Clean clone → `pnpm install && pnpm check` green. *(verify:init, CI on GitHub)*
- [x] Local app running from README in under 30 minutes. *(two projects set up from the README)*
- [x] `.env.example` complete; missing required var → clear startup error; `site` needs no DB/auth secrets. *(bootstrap/env.test.ts, CI build-minimal)*
- [x] Migrations run on an empty DB (`app`). *(integration global setup, e2e-app reset + migrate)*
- [x] Arch lint in CI; fixture test proves each rule catches its sample violation. *(tests/arch)*
- [x] Login/logout, protected route, dashboard tested; IDOR test (A cannot access B). *(auth/account int, e2e-app)*
- [x] Vertical slice works on a real deployment. *(2026-10-01: https://minh-starter-demo.vercel.app — Vercel + Neon + Resend, starter rc.9; magic link → notes CRUD → guarded routes → export → delete account, browser smoke test)*
- [x] Input validation, rate limiting, logging, security headers have automated checks.
- [x] Production build + unit, integration, critical E2E pass. *(CI)*
- [x] README, ARCHITECTURE, AGENTS, SECURITY, UPGRADING complete.
- [x] No product-specific code in Core/Modules (except `_example-notes`). *(arch rules; reuse projects needed no Core edits after rc.7)*
- [x] Reuse proofs: two real projects; one upgrade across tags; minimal config (all modules off) builds and runs. *(site A/A2 + app B (Bắc Việt Travel, deployed, real VNPay sandbox payments); upgrades rc.1→rc.2, rc.6→rc.7; migration step covered by CI per decision 2026-10-05 in docs/REUSE-PROOFS.md)*

## 4. Module DoD (required for "Stable")
- **All modules:** off → no secrets → build OK → endpoints 404 → no jobs.
- **jobs** (✅ tested; scheduler frequency per ADR-0002): parallel claim no duplicates; expired lease re-claimed; backoff retry; `dead` after maxAttempts, visible in admin; scheduler meets ADR-0002 frequencies.
- **billing/webhook** (✅ simulated; ⏳ real sandbox checkout): test-mode checkout E2E; signature verified; duplicates processed once; out-of-order safe; crash after store → sweeper completes; reconcile works.
- **entitlements** (✅): subscription update/cancel reflected; wrong key is a type error.
- **usage:** reserve/commit/release; parallel reserve never exceeds limit; duplicate idempotencyKey does not double count; crash after reserve handled; streaming disconnect commits used part.
- **email:** real send in test env; magic link works; retry with jobs.
- **storage** (✅ on S3-compatible server; ⏳ real R2): upload/download/delete, expiring signed URL, MIME + size + `ownerId` + quota checks.
- **analytics** (✅): standard events; consent respected.
- **admin** (✅): pages only for enabled modules; actions audit-logged.
- **blog** (✅): invalid post fails the build; prerendered; hreflang only for real translations; sitemap + RSS; off → 404 and absent from sitemap.
- **ai:** Beta until it has its own DoD.

## 5. Open questions
Tracked in [docs/adr/](docs/adr/) as *Proposed* ADRs and in [ROADMAP.md](ROADMAP.md) Phase 0.
