# Changelog

All notable changes to this starter are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: SemVer.

## [Unreleased]

### Added
- V0.2: profile "app": Postgres 18 (docker, UUIDv7), Drizzle with split starter/product migrations, Better Auth (magic link + optional Google, trusted-provider account linking) behind `AuthService`, roles and disabled users, optimistic `/dashboard` redirect in proxy, dashboard shell, account export (JSON) and delete (cascade), legal page templates, example-notes vertical slice with ownerId scoping, `no-db-in-ui-and-routes` lint rule, integration tests on real Postgres (CI service), `getPublicEnv()` so marketing pages prerender without secrets.
- V0.1b: `MailPort` (core/ports), `email` module (direct send) + Resend REST provider, rate limiting (Upstash REST or in-memory fallback), contact form (zod validation, honeypot, rate limit, server action, localized errors), "email off" tests, lint rules for module public API, modules-no-upward, vendor SDKs and DB drivers (8 rules, all with fixtures).
- V0.1a foundation: Next.js 16 + TS strict + Tailwind 4, config defaults/overrides, next-intl (vi default, en), env validation per profile/module, AppError, structured logger with redaction, SEO helpers + robots/sitemap with hreflang, marketing blocks, module system (defineModule/assertModuleEnabled/validateModules), lazy bootstrap container, dependency-cruiser rules with fixture test, security headers, CI (check + no-secrets build + E2E).
- Design documentation: README, ARCHITECTURE, AGENTS, CLAUDE, ROADMAP, REQUIREMENTS, SECURITY, CONTRIBUTING.
- ADR-0001 (stack), ADR-0002 (hosting/jobs), ADR-0003 (agent tooling), ADR-0004 (config overrides & migrations).
- Project skills under `.claude/skills/`.
- Design fixes over v2.1: see `docs/DESIGN-CHANGES-v2.2.md`.
