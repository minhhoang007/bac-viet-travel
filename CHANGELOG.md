# Changelog

All notable changes to this starter are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: SemVer.

## [Unreleased]

### Added — production hardening
- Error pages: `app/[locale]/error.tsx` (localized, shows a reference digest) and `app/global-error.tsx`; `instrumentation.ts` logs every server request error as one structured line (path without query).
- `/api/health` (200 / 503, `no-store`): database check and deployed commit; `container.health()`.
- `container.rateLimiter(name, rule)`: shared limiter for project features (Upstash when configured) — reuse finding G2.
- HTML version for plain-text emails (escaped, branded), applied automatically by the email module.
- Generated share images `/api/og` (title, brand colors, Vietnamese diacritics); `createMetadata` uses them for pages without an image (`seo.dynamicOgImage`).
- `.github/dependabot.yml` (weekly npm, monthly actions; TypeScript and ESLint majors pinned).

### Changed
- CI actions upgraded (checkout v7, setup-node v7, pnpm/action-setup v6; Node 24 runtime).
- `seo.defaultOgImage` defaults to the generated `/api/og` (the old `/og.png` never existed in the repo).
- Content: `error` section in `content/*/marketing.ts` (add it in projects).
- README, security review (rc.8 re-review) and REQUIREMENTS DoD updated with evidence.

## [1.0.0-rc.7] - 2026-10-01

### Added — UI kit (shadcn/ui) and reuse findings G1–G4
- shadcn/ui (Radix, new-york) in `components/ui/`: Button, Input, Textarea, Label, Select, Popover, Calendar, DatePicker (vi/en, submits YYYY-MM-DD), Dialog, Sheet, Accordion, Carousel, Separator, Toaster (sonner); `components.json`; icons via `lucide-react`.
- Theme: shadcn tokens derived from the 7 brand colors in `app/globals.css` (one source: `config/brand.ts`).
- Mobile menu (sheet) in the site header (G3); FAQ as an accessible accordion with answers kept in the HTML.
- `Hero` accepts an optional background `image` (G4); `content.hero.image` is optional.
- `product/layout.tsx` → `ProductLayoutExtras`: site-wide project UI after the footer (G1). `<Toaster />` mounted in the layout.
- Accessibility check (axe, WCAG 2 A/AA) in `tests/e2e/starter.spec.ts`; skill `.claude/skills/ui-components`.

### Changed
- `components/ui/button.tsx` is now shadcn's `Button` (+ `buttonVariants`); `ButtonLink` keeps its API.
- Content: `nav.menu` and `nav.close` in `content/*/marketing.ts` (add them in projects).

## [1.0.0-rc.6] - 2026-10-01

### Added — blog module (ADR-0007)
- `blog` module (site + app): MDX posts in `content/blog/<locale>/`, validated frontmatter, index with pagination, post and tag pages (all prerendered), drafts in development only.
- SEO for posts: OpenGraph `article`, JSON-LD `BlogPosting` (`articleJsonLd`), hreflang between translations (`translationKey`), sitemap entries, RSS feed per locale.
- `createMetadata` accepts `alternatePaths` (per-locale paths) and `article`.
- `init:project --modules blog`; sample posts removed unless `--keep-example`.

### Changed
- Content: new `blog` section in `content/*/app.ts` (add it in projects). New `config/blog.ts` (project-owned).

## [1.0.0-rc.5] - 2026-10-01

### Added — V1.2 ops (ADR-0006)
- `admin` module: `/admin` (404 for non-admins) with overview stats, users (search, disable/enable, role), failed jobs (retry), billing (failed webhooks, reprocess), audit log; every action recorded in `audit_logs`; `pnpm admin:grant <email>`.
- `analytics` module (site + app): first-party page views in Postgres, path-only, no IP/user agent stored, consent banner (daily visitor hash only with consent), stats in admin, 13-month retention, included in account export.
- `storage` module: direct uploads to S3-compatible storage (Cloudflare R2) with presigned URLs; type/size/quota checks (quota = `storage.max_bytes` entitlement), post-upload verification, expiring download URLs, objects deleted before the account; "My files" page.
- `jobs.list/retry`, `billing.adminOverview/retryWebhookEvent`, `entitlements.countActiveOwners`.
- Starter migration `0002` (audit_logs, analytics_events, files). docker compose `storage` service (SeaweedFS) for development and CI.

### Changed
- CSP `connect-src` accepts extra origins (`securityHeaders({ connectSrc })`); next.config adds `STORAGE_ENDPOINT`.
- Content: new `files`, `consent`, `admin` sections and `dashboard.nav.admin` in `content/*/app.ts` (add them in projects).
- Plans: new entitlement `storage.max_bytes` (projects with their own `config/billing.ts` plans must add it).

## [1.0.0-rc.4] - 2026-10-01

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
