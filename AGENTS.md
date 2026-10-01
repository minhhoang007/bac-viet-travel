# AGENTS.md

> Project rules override any global, user-level or plugin rules (ECC, marketplace skills, etc.).
> If rules conflict, follow this file and say so.

## Project
Minh Web App Starter: reusable Next.js starter. Profiles: `site` (no DB/auth) and `app` (DB + auth).
Layers: CORE (protected) → MODULES (optional) → PRODUCT (free). Wiring layer: `bootstrap/`, `providers/`, `app/`.
Dependencies flow one way: Product → Modules (public API only) → Core. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## How to work
- Follow the `karpathy-guidelines` skill: think first, simplest solution, surgical changes, verifiable goals.
- Work **one phase at a time** ([ROADMAP.md](ROADMAP.md)). Do not implement anything beyond the requested phase.
- Before editing, state the plan and the success check. After editing, run `pnpm check`.
- If a requirement is ambiguous or conflicts with the docs, stop and ask. Do not guess on architecture.

## Where you may work
- Need a protected file to show something project-specific (menu, home section, sitemap path, hero link)? Use the
  extension points: `config/navigation.ts`, `product/home.tsx`, `product/manifest.ts`, `content/**`. If none fits, propose one.
- ALLOWED: `product/**`, `app/dashboard/product/**`, `app/(product)/**`, `config/*.ts` project overrides,
  `content/**`, new files under `tests/**`, new migrations in `db/migrations/product/`.
- PROTECTED (explain the technical reason first, then edit):
  `core/**`, `components/**`, `modules/**`, `providers/**`, `bootstrap/**`, `app/**` outside product routes,
  `config/*.defaults.ts`, `db/migrations/starter/`.
- NEVER edit an existing migration. Add a new one.
- NEVER delete Core/Modules tests. Never edit `tests/e2e/starter.spec.ts`; project E2E goes in `tests/e2e/site.spec.ts`.

## Architecture rules (enforced by `pnpm check`)
- Core never imports Modules/Product/providers/bootstrap. Core needs something → define a port in `core/ports/`.
- Import modules only via `modules/<name>/index.ts`; a module imports another module only if declared in `requires`/`uses`.
- Only `bootstrap/` imports `providers/`.
- Vendor SDKs (billing, email, storage, AI, auth library) only in `providers/**` and `core/auth/adapters/**`.
- DB drivers (`pg`, `postgres`) only in `db/**`. `drizzle-orm` is allowed in `**/schema.ts`, `**/repository.ts`,
  `**/service.ts` and `product/services/**` — nowhere in `app/`, `components/`, `product/components/`, `product/actions/`.
- Route handlers stay thin: guard module → validate → call a service from `getContainer()`.
- No top-level env reads or SDK initialization anywhere outside `bootstrap/env.ts`: initialize lazily in factories.
  This includes `config/**` (use functions such as `getPriceIds()`, not `env.X` at module scope).
- Every route/page/action of an optional module calls `assertModuleEnabled("<name>")`.
- Every user-owned table has `ownerId`; every query on user data filters by it.
- `proxy.ts` only reads cookies (optimistic redirect); real auth checks happen in pages/actions/routes via `app/_lib/session.ts`.
- Pages needing runtime secrets go through `requireAppServices()`/`requirePageUser()` (request-time rendering). Static pages use `getPublicEnv()`, never `getEnv()`, so builds need no secrets.
- Another user's record must be indistinguishable from a missing one: services return `NOT_FOUND`, pages respond 404.

## Conventions
- TypeScript strict. Validate all external input with schemas (zod).
- Money/cost: integers (minor units / micro-USD), never floats.
- Entitlement keys: `<domain>.<feature>[.<period>]`, defined in `config/billing.ts` or `product/manifest.ts`.
- Errors: throw `AppError` codes; never return raw DB/provider errors.
- User-visible strings live in `content/` (i18n-ready).

## Security and correctness
- Never log secrets, tokens or personal data. Never commit `.env*` (except `.env.example`).
- Webhooks: verify signature on raw body; store event + enqueue job in one transaction; ack fast; idempotent handler;
  states received → processing → processed/failed/dead; sweeper re-queues stale ones.
- Usage: reserve → execute → commit/release with an idempotencyKey. Never check-then-write.
- Server-side calls into auth/SDK libraries (`auth.api.*`) skip their HTTP rate limiters: rate-limit in the service.
- Logs: ids and `kind` only — never subjects, bodies, names, emails or IPs.
- External stores in user flows (rate limit, email) must fail safely: catch and return a state, never crash the action.
- Jobs: idempotent, resumable, respect lease and maxAttempts.
- Account linking only for verified emails from trusted providers.

## Definition of done for any task
1. `pnpm check` passes.
2. New behavior has tests; auth/billing/webhook/usage/jobs changes include failure-path integration tests.
3. If you touched an optional module: the "module off" test still passes.
4. No protected-path edits without justification in the PR description.
5. Docs/CHANGELOG updated when behavior or config changes.

## Project skills
`.claude/skills/`: `karpathy-guidelines`, `phase-execution`, `product-feature`, `module-authoring`,
`tdd-critical-flows`, `security-review-starter`, `starter-upgrade`, `ui-components`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
