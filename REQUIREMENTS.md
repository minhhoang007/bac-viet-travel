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
- [ ] Clean clone → `pnpm install && pnpm check` green.
- [ ] Local app running from README in under 30 minutes.
- [ ] `.env.example` complete; missing required var → clear startup error; `site` needs no DB/auth secrets.
- [ ] Migrations run on an empty DB (`app`).
- [ ] Arch lint in CI; fixture test proves each rule catches its sample violation.
- [ ] Login/logout, protected route, dashboard tested; IDOR test (A cannot access B).
- [ ] Vertical slice works on a real deployment.
- [ ] Input validation, rate limiting, logging, security headers have automated checks.
- [ ] Production build + unit, integration, critical E2E pass.
- [ ] README, ARCHITECTURE, AGENTS, SECURITY, UPGRADING complete.
- [ ] No product-specific code in Core/Modules (except `_example-notes`).
- [ ] Reuse proofs: two real projects; one upgrade across tags; minimal config (all modules off) builds and runs.

## 4. Module DoD (required for "Stable")
- **All modules:** off → no secrets → build OK → endpoints 404 → no jobs.
- **jobs:** parallel claim no duplicates; expired lease re-claimed; backoff retry; `dead` after maxAttempts, visible in admin; scheduler meets ADR-0002 frequencies.
- **billing/webhook:** test-mode checkout E2E; signature verified; duplicates processed once; out-of-order safe; crash after store → sweeper completes; reconcile works.
- **entitlements:** subscription update/cancel reflected; wrong key is a type error.
- **usage:** reserve/commit/release; parallel reserve never exceeds limit; duplicate idempotencyKey does not double count; crash after reserve handled; streaming disconnect commits used part.
- **email:** real send in test env; magic link works; retry with jobs.
- **storage:** upload/download/delete, expiring signed URL, MIME + size + `ownerId` + quota checks.
- **analytics:** standard events; consent respected.
- **admin:** pages only for enabled modules; actions audit-logged.
- **ai / blog:** Beta until they have their own DoD.

## 5. Open questions
Tracked in [docs/adr/](docs/adr/) as *Proposed* ADRs and in [ROADMAP.md](ROADMAP.md) Phase 0.
