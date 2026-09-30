# Changelog

All notable changes to this starter are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: SemVer.

## [Unreleased]

### Added — V1.1 SaaS (ADR-0002, ADR-0005)
- `jobs` module: Postgres job queue (SKIP LOCKED claim, lease, backoff, dead, dedupe, purge), `/api/jobs/run`, Vercel Cron (`vercel.json`).
- `entitlements` module: time-bounded access grants, stacked periods, typed `can` / `getLimit`.
- `billing` module: Polar subscriptions (checkout, customer portal, webhook state machine with sweeper and reconcile, official SDK verification) and VNPay one-time period purchases (signed payment URL, IPN, return page); pricing page and dashboard billing page.
- Email retries through jobs when direct send fails.
- Account deletion revokes live Polar subscriptions first (aborts if the provider fails); account export includes billing records; financial records are anonymized, not deleted.
- `init:project --modules billing` (adds jobs + entitlements); starter migration `0001` (jobs, access_grants, webhook_events, subscriptions, billing_orders).
- Tests: integration (jobs concurrency, webhooks duplicate/out-of-order/crash/dead, VNPay IPN codes), provider tests (Polar SDK signature, VNPay HMAC), browser E2E for billing with signed simulated provider traffic.

### Changed
- Module nav labels can be per-locale. Content: new `billing` section in `content/*/app.ts` (add it in projects).

## [1.0.0-rc.3] — 2026-09-30

Upgrade friction found by upgrading Hạ Long Tours rc.1 → rc.2 (docs/REUSE-PROOFS.md U1–U4).

### Changed
- Starter version lives in `.starter-version`; `package.json` version fixed at `0.0.0`; `init:project` sets the project version to `0.1.0`.
- E2E split into starter-owned, content-agnostic `tests/e2e/starter.spec.ts` and project-owned `tests/e2e/site.spec.ts`.

### Docs
- Release rules that keep upgrades conflict-free (CONTRIBUTING); conflict-resolution table (UPGRADING).

## [1.0.0-rc.2] — 2026-09-30

Extension points found by the first real project (Hạ Long Tours, docs/REUSE-PROOFS.md F1–F7).

### Added
- `config/navigation.ts` (header links, per-locale labels) over `config/navigation.defaults.ts`.
- `product/home.tsx` `ProductHomeSections`: product sections on the home page.
- `sitemapPaths` in `product/manifest.ts`; sitemap also lists `/terms`, `/privacy`.
- `serializeJsonLd` (core/seo) and `<JsonLd>` (components/ui).
- `ContactForm` `defaults` prop.
- `tests/e2e/server-env.ts`: env for the Playwright production server.

### Changed (breaking for content)
- Hero button targets come from content (`hero.primaryHref`, `hero.secondaryHref`).
- Header link labels moved from `content.nav` to `config/navigation.ts`.

### Security
- Magic-link requests are rate limited per client (5/10 min) and per recipient (3/10 min) in `AuthService`; server-side `auth.api.*` calls bypassed Better Auth's HTTP limiter (P1).
- Email logs contain only `{ id, kind }` — no subject (which carried the contact sender's name).
- Rate limiters fall back to in-memory when Upstash fails; the contact form never throws on limiter errors.

### Fixed
- `config/brand.ts` colors now drive the theme (light/dark CSS variables generated and validated from config).

### Added
- `pnpm test:e2e:app`: browser E2E for profile app on a fresh app-profile clone (sign in, notes CRUD, IDOR, export, delete, sign out, rate limit, invalid link) + CI job.

## [1.0.0-rc.1] — 2026-09-30

### Added
- V1.0: `pnpm init:project` (name, profile, modules, removes the example slice, writes `starter.lock.json`), `pnpm verify:init`, security review report, DEPLOY and REUSE-PROOFS docs, full README.

### Security
- Contact subject strips control characters; production requires an https site URL; `BETTER_AUTH_SECRET` ≥ 32 chars; no client IP in honeypot logs; invalid/expired magic links land on the login page with a message.

### Changed
- Example notes strings live in `product/_example-notes/content.ts`; `productNav` labels are per-locale; Better Auth `appName` comes from `config/app.ts`.

### Added (earlier phases)
- V0.2: profile "app": Postgres 18 (docker, UUIDv7), Drizzle with split starter/product migrations, Better Auth (magic link + optional Google, trusted-provider account linking) behind `AuthService`, roles and disabled users, optimistic `/dashboard` redirect in proxy, dashboard shell, account export (JSON) and delete (cascade), legal page templates, example-notes vertical slice with ownerId scoping, `no-db-in-ui-and-routes` lint rule, integration tests on real Postgres (CI service), `getPublicEnv()` so marketing pages prerender without secrets.
- V0.1b: `MailPort` (core/ports), `email` module (direct send) + Resend REST provider, rate limiting (Upstash REST or in-memory fallback), contact form (zod validation, honeypot, rate limit, server action, localized errors), "email off" tests, lint rules for module public API, modules-no-upward, vendor SDKs and DB drivers (8 rules, all with fixtures).
- V0.1a foundation: Next.js 16 + TS strict + Tailwind 4, config defaults/overrides, next-intl (vi default, en), env validation per profile/module, AppError, structured logger with redaction, SEO helpers + robots/sitemap with hreflang, marketing blocks, module system (defineModule/assertModuleEnabled/validateModules), lazy bootstrap container, dependency-cruiser rules with fixture test, security headers, CI (check + no-secrets build + E2E).
- Design documentation: README, ARCHITECTURE, AGENTS, CLAUDE, ROADMAP, REQUIREMENTS, SECURITY, CONTRIBUTING.
- ADR-0001 (stack), ADR-0002 (hosting/jobs), ADR-0003 (agent tooling), ADR-0004 (config overrides & migrations).
- Project skills under `.claude/skills/`.
- Design fixes over v2.1: see `docs/DESIGN-CHANGES-v2.2.md`.
