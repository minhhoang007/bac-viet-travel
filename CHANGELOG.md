# Changelog

All notable changes to this starter are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: SemVer.

## [Unreleased]

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
