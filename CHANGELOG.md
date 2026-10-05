# Changelog

All notable changes to this starter are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: SemVer.

## [Unreleased]

### Added — project header and fonts
- Optional `ProductHeader({ locale })` and `productFontVariables` exports in `product/layout.tsx`: replace the starter header; load fonts with next/font into `--brand-font-sans` / `--brand-font-heading` (Tailwind `font-sans`, `font-heading`; h1–h3 use the heading font). Without them nothing changes.

## [1.1.1] - 2026-10-05

### Fixed — CI in projects
- `Build + E2E` has a Postgres service and `E2E_DATABASE_URL`, so a project in profile app runs its own E2E in CI (the build still gets no secrets). The starter's example-app E2E job runs only in the starter repo (no `starter.lock.json`).

## [1.1.0] - 2026-10-05

CMS groundwork: editor role, media library (Cloudinary), editorial workflow, project footer, UI foundation. **Two starter migrations** (`media_assets`; `content_items`, `content_versions`): run them on a database copy first.

### Added — UI foundation
- Status color tokens `danger` / `warning` / `success` (light and dark, WCAG AA as text) in `app/globals.css`; raw palette colors removed from starter components.
- `Notice` (`components/feedback/notice.tsx`; `ResultNotice` uses it), `Table` primitives (`components/ui/table.tsx`) on every admin list, `EmptyState` on every empty admin list.
- `SubmitButton` takes `variant` / `size` and sets `aria-busy`; every mutating form uses it (no double submits).
- axe scans the admin pages in the app E2E. Skill `ui-components`: status colors, Notice / Table, SubmitButton rule, a section for staff-facing pages.

### Added — project footer
- Optional `ProductFooter({ locale })` export in `product/layout.tsx` replaces the starter footer (one footer with the project's columns and legal block).

### Added — editorial workflow (CMS, ADR-0009)
- Module `content` (profile app, requires admin): drafts and live copies as JSON per project content type (manifest `contentTypes`), review (editor submits, admins emailed; admin publishes, schedules or sends back with a note), hide/show, version history with restore, optimistic locking (`revision`, `CONFLICT`), scheduled publishing on the jobs tick (`content.publish_due`).
- Review queue `/admin/content`, `<WorkflowPanel>` / `<ContentResult>` (`app/_components/workflow-panel.tsx`) for project edit pages; admin workflow actions are audited.
- Draft Mode preview `/api/content/preview`; `readContent(type, slug)` (`app/_lib/content.ts`) and `<PreviewBanner>` for public pages.
- `appConfig.timeZone` (default `Asia/Ho_Chi_Minh`) and `zonedToUtc` / `utcToZoned` (`core/i18n/time-zone.ts`).

### Added — media library (CMS groundwork, ADR-0008)
- Module `media` (profile app, requires admin): public images on Cloudinary's free plan. Staff (editors and admins) upload several images at once at `/admin/media`; the browser posts straight to Cloudinary with a server signature (`allowed_formats` signed); on confirm the server reads what Cloudinary stored and rejects other formats or sizes. Alt text per locale, focal point picker, search, deletion blocked while a project reports the image in use (manifest `mediaInUse`), hourly purge of unconfirmed uploads.
- `media.imageProps(asset, { aspect, widths })` + `<MediaImage>`: responsive `srcSet` from Cloudinary (`f_auto,q_auto`, crop around the focal point), no Vercel image-optimization quota.
- Adapter `providers/media/cloudinary.ts` over the REST API (no SDK); signature checked against Cloudinary's documented example.
- `AppError` code `CONFLICT` (409). CSP allows Cloudinary origins when the module is on.

### Added — editor role (CMS groundwork)
- Role `editor` besides `user` and `admin` (no migration). `hasRole` is hierarchical (admin ⊇ editor ⊇ user); `requireRole(h, "editor")` admits admins.
- `requireStaff(role)` in `app/_lib/admin.ts`; `requireAdmin()` = `requireStaff("admin")`. Editors open the admin layout but only product pages whose `productAdminNav` entry lists `roles: ["editor"]`; every starter admin page (users, jobs, billing, audit) stays admin-only.
- Admin user page: choose user / editor / admin. `pnpm admin:grant <email> --role editor`.

## [1.0.2] - 2026-10-05

### Security
- `better-auth` 1.7.7: fixes a critical Magic Link account takeover when Google (or another OAuth provider) is enabled ([GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm)). Magic links sent before the upgrade stop working; users request a new one.

### Changed
- Dependency updates (next 16.3.8, next-intl 4.14.9, AWS SDK, Polar SDK, vitest…).
- E2E helpers read magic-link tokens with the new `magic-link:` identifier prefix.

## [1.0.1] - 2026-10-05

### Changed — agent skills (ideas from DietrichGebert/ponytail, adapted; plugin not installed)
- `karpathy-guidelines` §2: reuse order before new code (repo → stdlib → platform feature → installed dependency) and `// simplification:` comments for deliberate shortcuts.
- `systematic-debugging`: grep every caller and fix in the shared function.

### Fixed
- Blog: unknown slugs, pages and tags are 404 without Next's `NoFallbackError` in the server log (`dynamicParams = false` removed; the pages already call `notFound()`).

## [1.0.0] - 2026-10-05

First stable release. Same code as `1.0.0-rc.16`.

- All REQUIREMENTS §3 items done: two real projects (site: Hạ Long Tours; app: Bắc Việt Travel, deployed with real VNPay
  sandbox payments), upgrades across tags (rc.1→rc.2, rc.6→rc.7, rc.12→rc.16), minimal configuration in CI.
- The migration-during-upgrade step is covered by CI (owner decision 2026-10-05, docs/REUSE-PROOFS.md).

## [1.0.0-rc.16] - 2026-10-05

### Added — found on Bắc Việt Travel (project B)
- VNPay `query()` (querydr) on the payment adapter: `paid` with IPN-shaped params, `unpaid`, `not_found`; response signature verified. Periodic `billing.reconcile_vnpay` confirms orders paid at VNPay whose IPN never arrived (G11).
- Favicon from the brand: `app/icon.tsx`. `pnpm launch:check` reports a missing favicon.

### Fixed
- `/favicon.ico` and any one-segment path with a dot answered 500 (reached the home page as the locale); now 404 (G12).
- VNPay billing orders send their stored `createdAt` as `vnp_CreateDate`, so querydr finds them.
- Storage uploader: the file input is disabled until hydration (a file picked earlier was dropped silently); fixes a flaky E2E. The admin E2E retries the confirm-dialog trigger for the same reason.

### Docs
- V1.0 reuse proofs complete: project B (Bắc Việt Travel) recorded; migration-upgrade step covered by CI (owner decision 2026-10-05).

## [1.0.0-rc.15] - 2026-10-05

### Added — agent skills (ideas from obra/superpowers, adapted; plugin not installed)
- Skill `systematic-debugging`: root cause before any fix; stop after 3 failed fixes.
- Skill `receiving-code-review`: verify each review finding against the code and repo rules before changing it.
- `karpathy-guidelines` §5 "Verify before claiming done": every "done" cites a command run in the session and its output.

### Added — reuse/security findings (rc.15)
- Shared VNPay IPN: `/api/billing/vnpay/ipn` verifies the signature once, then offers the order to the product (manifest `vnpayIpn`), then to billing. Works without the billing module. Helpers `checkVnpayOrder`, `VNPAY_CONFIRMED` in `core/payments/vnpay-ipn.ts` (reuse finding G8b).
- Per-user rate limit on Polar checkout/portal and VNPay payment creation (10 / 10 min).
- Periodic `billing.purge_orders`: deletes VNPay orders still pending after 24 h.

### Fixed
- `/pricing`: the free plan shows a formatted price ("0 ₫" / "$0") instead of "0".
- `pnpm launch:check`: robots.txt is reported as blocking the site only when the `User-agent: *` group has `Disallow: /` (blocking one bot such as GPTBot is fine).

## [1.0.0-rc.14] - 2026-10-02

### Added — ship fast (lessons from ShipFast, keeping the architecture and tests)
- `docs/QUICKSTART.md` (clone → configure → deploy → check on one page) and `docs/LAUNCH.md` (domain, email DNS SPF/DKIM/DMARC, payments, legal-page prompt, monitoring).
- `pnpm setup:check`: Node version, env missing for the profile and enabled modules, database reachable. Prints names only. Uses the same rules as runtime (`envProblems()` in `bootstrap/env.ts`).
- `pnpm launch:check <url>`: HTTPS, title/description/canonical, share image, security headers, robots.txt, sitemap, `/api/health`, legal pages of a deployed site.
- Landing blocks in `components/marketing/`: `Pricing`, `Steps`, `ProblemSolution`, `Testimonials`, `LogoCloud`. The home page renders each one when its optional key is set in `content/<locale>/marketing.ts`; the billing `/pricing` page now uses `Pricing` too.
- `scripts/ts-alias.mjs`: lets `node` run scripts that import project code (`@/…`).

## [1.0.0-rc.13] - 2026-10-02

### Added — dashboard kit (patterns from shadcn-admin, no fork)
- `components/app-shell/`: `AppShell` for dashboard and admin — shadcn `sidebar` (collapsible, state kept in the `sidebar_state` cookie, sheet on mobile, current page from the URL), skip link; `PageHeader` (breadcrumb, the page's only `h1`, description, actions).
- `components/feedback/`: `EmptyState`, `ErrorState`, `ConfirmDialog` (admin "disable user" / role changes now ask first).
- `components/forms/`: `FormField` (label + input + error with aria wired), `FormError`, `SubmitButton` (`useFormStatus`), `FormState<F>` + `toFormState(error, fields)` mapping zod / `AppError` to field or form errors. Contact, login and the notes example use them.
- shadcn `sidebar`, `tooltip`, `skeleton` in `components/ui/`; sidebar colors derive from the brand tokens.

### Changed
- Notes example: field errors show under the field (`#note-title-error`) instead of one message for the form.

### Removed
- `components/dashboard/shell.tsx` (`DashboardShell`) — use `AppShell` (see UPGRADING).

## [1.0.0-rc.12] - 2026-10-01

### Fixed (found on a real deployment, reuse finding G10)
- Dynamic pages that read `content/` from disk (e.g. a booking page listing tours from MDX) returned 404 on Vercel: the files were not bundled with the serverless function. `next.config.ts` now traces `content/**` into every function.

## [1.0.0-rc.11] - 2026-10-01

### Added — admin pages for product features (reuse finding G9)
- `productAdminNav` in `product/manifest.ts`: product pages appear in the `/admin` menu (optional export; older manifests keep working).
- `ProductContext.audit` (admin module on): product admin actions write to the same audit log as user management.

## [1.0.0-rc.10] - 2026-10-01

### Added — found while building a real app project (reuse findings G7, G8)
- `ProductContext` (`core/product/context.ts`): `createProduct(db, ctx)` now also receives `logger`, `mail`, `rateLimiter(name, rule)`, `payments`, `jobs` (when the jobs module is on) and `now`.
- Product jobs: `createProduct` may return `jobs: { handlers, periodic }`; they are registered with the jobs module (periodic tasks run as `product.<name>` on every tick). Ignored with a warning when the jobs module is off.
- `container.payments.vnpay`: one-time VNPay payments configured by env alone (no billing module needed), with a `sandbox` flag. The billing module reuses the same instance.
- Env: `VNPAY_TMN_CODE` and `VNPAY_HASH_SECRET` must be set together.

### Changed
- `OneTimePaymentProvider` moved to `core/ports/payments.ts` (still re-exported by `@/modules/billing`).

## [1.0.0-rc.9] - 2026-10-01

### Fixed (found on the first real Vercel deployment)
- Without `NEXT_PUBLIC_SITE_URL`, canonical URLs, sitemap and share images pointed to `http://localhost:3000`. On Vercel the production domain (`VERCEL_PROJECT_PRODUCTION_URL`) is now used as fallback, and a Vercel production deployment with a missing or localhost URL fails with a clear error.
- Profile site: `/dashboard` redirected to a login page that does not exist; it is now a plain 404.

## [1.0.0-rc.8] - 2026-10-01

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
