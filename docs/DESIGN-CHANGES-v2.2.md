# Design changes v2.1 → v2.2

The v2.1 design document remains the reference for rationale. These fixes override it where they conflict.

| # | v2.1 problem | v2.2 decision | Where |
|---|---|---|---|
| 1 | Vendor-SDK lint rule banned `drizzle-orm` outside `db/`, but schemas and services use it | Only DB drivers (`pg`, `postgres`) restricted to `db/**`. `drizzle-orm` allowed in schema/repository/service files, banned in UI, routes, product components/actions | AGENTS.md, ARCHITECTURE §3 |
| 2 | `site` profile claimed "no secrets" but contact form needs email + Redis | `site` needs no DB/auth secrets. Email secret required if contact form is on. Rate limit falls back to in-memory without Redis | ARCHITECTURE §2 |
| 3 | `config/billing.ts` read env at module scope (breaks lazy init) | Config exposes functions (`getPriceIds()`); no env reads at module scope outside `bootstrap/env.ts` | AGENTS.md |
| 4 | Magic link with `email` off fails at login time, not startup | Startup check: `app` + magic link ⇒ `email` must be on | ARCHITECTURE §6 |
| 5 | `config/features.ts` edited by every project → conflicts on every upgrade | `config/*.defaults.ts` (starter-owned) + `config/*.ts` overrides (project-owned) | ADR-0004 |
| 6 | Starter and project migrations share one folder/journal → guaranteed conflicts | Two Drizzle configs, folders, and migration tables; starter runs first | ADR-0004 |
| 7 | Auth and jobs routes need DB access vs "no DB in app/" rule | Allowed only through services from `getContainer()`; direct `db/` import stays forbidden | AGENTS.md |
| 8 | V0.1 built full module-deps checker + 8 fixtures with only one module | V0.1: 3 core rules + fixtures; V0.1b: module/vendor rules; `check-module-deps.ts` in V1.1 | ROADMAP |
| 9 | No test DB strategy | Real Postgres in CI (service container / Testcontainers); PGlite not used for concurrency tests | ADR-0001 |
| 10 | Edge middleware cannot use DB/container | Middleware reads cookies only; real checks in server code | AGENTS.md |
| 11 | Webhook insert and enqueue were separate steps | Same transaction (outbox); sweeper remains as a safety net | AGENTS.md |
| 12 | V1.0 depends on two real projects with no interim release | `v1.0.0-rc.N` tags for use while collecting reuse proofs | ROADMAP |
| 13 | Agent tooling unspecified; risk of conflicting global rules | ADR-0003: project rules win; external tooling pinned and user-level only | ADR-0003 |
