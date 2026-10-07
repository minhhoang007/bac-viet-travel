# Upgrading a project to a newer starter version

Strategy: clone with history + release tags ([ADR-0004](adr/0004-config-overrides-and-migrations.md)).

## Procedure

1. Read `CHANGELOG.md` and the version sections below for every tag between yours (`starter.lock.json`) and the target.
2. Back up / snapshot a copy of the production DB.
3. ```bash
   git fetch starter --tags
   git checkout -b upgrade/vX.Y.Z
   git merge vX.Y.Z
   ```
4. Resolve conflicts with this table:

   | Conflict in | Resolution |
   |---|---|
   | starter-owned (`core/`, `modules/`, `components/`, `bootstrap/`, `*.defaults.ts`, `tests/e2e/starter.spec.ts`) | take **theirs**; if you had edited it, re-apply your change through an extension point or send it upstream |
   | project-owned (`config/*.ts`, `content/`, `product/`, `tests/e2e/site.spec.ts`, `tests/e2e/server-env.ts`) | take **ours**, then add any new fields listed in the version notes |
   | same new file added by both sides (you created an extension-point file before the starter shipped it) | take **ours** |
   | `pnpm-lock.yaml` | take theirs, then `pnpm install` |
5. `pnpm install && pnpm check && pnpm test:int && pnpm test:e2e`.
6. Run `pnpm db:migrate` against the DB copy. Verify.
7. Update `starter.lock.json`, open PR, merge, deploy.
8. Record conflicts you hit in the starter repo (issue or PR) — this feeds reuse proof 36.B-2.

## Migration conflicts
Starter migrations live only in `db/migrations/starter/` with their own journal table, so they never interleave with product migrations. If a starter migration touches a table the product extends, the version notes below say so.

## Version notes

<!-- Template for each release:
### vX.Y.Z
- Breaking: ...
- Required action: ...
- Migrations: ...
- Config: new defaults / renamed keys ...
-->

### v1.12.0 (2026-10-07) — admin overview figures
- Optional: return `adminOverview` from `createProduct` in `product/manifest.ts` (project-owned) to show product figures on `/admin`. Nothing to do otherwise.
- No migration.

### v1.11.0 (2026-10-07) — CI traces, knip, esbuild, minor deps
- `knip.json` (project-owned after the first merge): set `"playwright": false` and add `"playwright*.config.ts"`, `"tests/e2e/**/*.ts"` to `entry` (plus any other test folders), or knip fails in CI when your E2E config touches a database.
- `pnpm-workspace.yaml`: new override for esbuild under `@esbuild-kit/core-utils`; run `pnpm install`.
- No migration.

### v1.10.0 (2026-10-07) — agent setup, E2E image fix
- `next.config.ts` and `.github/workflows/ci.yml` (starter-owned): take theirs. Never set `E2E_UNOPTIMIZED_IMAGES` in a real deployment.
- New starter-owned files: `.claude/settings.json`, `.claude/hooks/check-edited.mjs`, `.claude/skills/merge-stack/`, `.mcp.json`. Personal permissions stay in `.claude/settings.local.json` (not committed).
- No migration.

### v1.9.0 (2026-10-07) — guardrails, CI minutes
- `pnpm check` now runs `knip` and `jscpd`. After merging: `pnpm install`, then `pnpm knip` and `pnpm dup`.
  Project files the starter config does not know (extra scripts, configs, runtime-read files) go in `entry` /
  `ignore` of `knip.json` (project-owned after the first merge: keep **ours**). Remove what knip reports as unused,
  or list it there with a reason.
- ESLint `max-lines` 450: split a file that goes over (see the `refactor` skill) rather than raising the limit.
- No migration.

### v1.4.0 (2026-10-06) — content validation
- No migration. New content key `admin.content.incomplete` (projects overriding `content/` must add it).
- Optional `validate(data)` on each `contentTypes` entry: return the problem fields; incomplete drafts can no longer be
  submitted or published.

### v1.3.1 (2026-10-06) — sitemap import fix
- No migration, nothing required.

### v1.3.0 (2026-10-06) — published content for products, security
- No migration. Run `pnpm install` (new pnpm override for `source-map-js`, GHSA-68fv-2mgg-jv7q, in `pnpm-workspace.yaml`).
- `app/sitemap.ts` is now async and rendered per request. `sitemapPaths` may be an async function `({ content }) => paths`.
- `ProductContext.content` (content module on): `listPublished(type)`.

### v1.2.0 (2026-10-06) — project header and fonts
- No migration, nothing required. Optional exports in `product/layout.tsx`: `ProductHeader`, `productFontVariables`.
  `app/globals.css` now sets `body` and h1–h3 fonts through `--font-sans` / `--font-heading` (same system fonts by default).

### v1.1.1 (2026-10-05) — CI in projects
- No migration. `.github/workflows/ci.yml`: take the starter's version (projects now run their own E2E with a Postgres service; the example-app job is skipped in projects).

### v1.1.0 (2026-10-05) — CMS groundwork
Two starter migrations: create a Neon branch, run `pnpm db:migrate` against it and the E2E suite, then migrate production. Both only add tables (unused while `media` / `content` are off).

#### Editorial workflow (starter migration)
- **Starter migration** (`content_items`, `content_versions`): run `pnpm db:migrate` (database copy first).
- New content keys: `admin.nav.content`, `admin.content.*`. New config key `appConfig.timeZone` (projects spreading
  `appDefaults` get it).
- To use it: `features.content = true` (needs `admin`; `email` for review emails, `jobs` for scheduled publishing),
  export `contentTypes` from `product/manifest.ts`, read public content with `readContent(type, slug)` or
  `container.content.listPublished(type)`, and put `<WorkflowPanel>` on your edit pages.
- Scheduled publishing runs on the jobs tick: set a frequent cron (Vercel Pro) for timely publishing.

#### Media library (starter migration)
- **Starter migration** (`media_assets`): run `pnpm db:migrate` (on a database copy first, see Procedure). The table is
  created even when the module is off.
- New config pair `config/media.defaults.ts` (starter) / `config/media.ts` (project-owned: set `folder`).
- New content keys: `admin.nav.media`, `admin.media.*` (projects overriding `content/` must add them).
- To use it: `features.media = true` (needs `admin`), set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`. Optional: export `mediaInUse(db, id)` from `product/manifest.ts` to block deleting images
  your published content uses.
- `features` gains `media: false` (projects spreading `featureDefaults` get it automatically).

#### Project footer, UI foundation
- Optional `ProductFooter({ locale })` in `product/layout.tsx` replaces the starter footer.
- New status tokens `danger` / `warning` / `success`, `Notice`, `Table`; `SubmitButton` gains `variant` / `size`. Project
  code using raw palette colors keeps working; move it to the tokens when you touch it.

#### Editor role
- New content keys `admin.users.changeRole`, `admin.users.roles` (projects overriding `content/` must add them).
- `product/manifest.ts` (project-owned): optionally add `roles?: readonly ("editor" | "admin")[]` to `ProductNavItem`
  and `roles: ["editor"]` to admin entries editors may open; guard those pages with `requireStaff("editor")`.
- Code comparing `user.role === "admin"` keeps working; prefer `hasRole(user, "admin")`.
- No migration.

### v1.0.2 (2026-10-05) — security: better-auth 1.7.7
- **Upgrade promptly if Google sign-in is enabled** (Magic Link account takeover, GHSA-965c-763c-88jm). No migration.
- Pending magic links stop working after deploy; users request a new one.
- Project tests that read magic-link tokens from the `verifications` table must strip the new `magic-link:` prefix
  (see `tests/e2e-app/app.spec.ts`).

### v1.0.1 (2026-10-05) — blog 404 log noise, agent skills
- No action needed. Blog routes no longer export `dynamicParams = false` (unknown URLs still 404).

### v1.0.0 (2026-10-05) — stable
- Same code as rc.16: no action beyond the rc.16 notes. Projects on rc.N can move to `v1.0.0` with a plain merge.

### v1.0.0-rc.16 (2026-10-05) — favicon, VNPay reconcile
- **Favicon:** `app/icon.tsx` draws the first letter of `brand.logoText` on the primary color. Own icon: add
  `app/favicon.ico` (project-owned). `proxy.ts` no longer handles `/icon`. Paths with a dot (`/favicon.ico`, `/x.txt`) are
  now 404 instead of 500.
- **VNPay reconcile:** `OneTimePaymentProvider` has `query({ txnRef, createdAt })` (VNPay querydr): `paid` (with
  IPN-shaped params), `unpaid` or `not_found`; throws on provider errors. Pass the same `createdAt` you gave
  `buildPaymentUrl` (store it). Billing runs `billing.reconcile_vnpay` before `billing.purge_orders`.
  **Products with VNPay holds:** before expiring a hold whose payment is still pending, call
  `ctx.payments.vnpay.query(...)`; on `paid`, run your IPN handler with `result.params`. Custom fakes of
  `OneTimePaymentProvider` need a `query` method.
- No migration.

### v1.0.0-rc.15 (2026-10-05) — shared VNPay IPN, checkout limits
- **Product VNPay payments:** return `vnpayIpn` from `createProduct` (type `VnpayIpnHandler`, `@/core/payments/vnpay-ipn`).
  The endpoint `/api/billing/vnpay/ipn` now exists whenever `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET` are set (billing
  module or not), verifies the signature once, then offers each IPN to the product handler, then to billing. Your
  handler gets verified params, returns `null` for txnRefs that are not yours, and should use `checkVnpayOrder(order, params)`
  (amount + still pending) before updating the order in one conditional `UPDATE … WHERE status = 'pending'`.
  If you wrote your own IPN route for product orders, move its logic into `vnpayIpn` and register the starter URL at VNPay.
- Checkout, portal and VNPay payment creation are limited to 10 per user per 10 minutes (`?error=rate_limited`).
  New content key `billing.rateLimited` (projects overriding `content/` must add it).
- VNPay billing orders still `pending` after 24 hours are deleted by the jobs tick (`billing.purge_orders`).
- No migration.

### v1.0.0-rc.14 (2026-10-02) — ship fast
- New optional marketing content keys (`logos`, `problemSolution`, `steps`, `testimonials`, `pricing`). The starter's
  sample content sets `problemSolution`, `steps` and `pricing`: if your project overrides `content/`, nothing changes;
  if it uses the starter files, edit or delete those keys.
- New scripts `setup:check`, `launch:check` (package.json is merged on upgrade: keep both script lines).
- No migration.

### v1.0.0-rc.13 (2026-10-02) — dashboard kit
- **Breaking (only if project code imports it):** `components/dashboard/shell.tsx` is gone. Use `AppShell` from
  `@/components/app-shell/app-shell`: same props plus `labels` (`getAppContent(locale).dashboard.shell`) and
  `defaultOpen` (`await sidebarDefaultOpen()` from `@/app/_lib/sidebar`).
- New content keys: `dashboard.shell`, `admin.confirmTitle`, `admin.cancel`, `admin.users.confirmDisable|confirmRole`
  (projects overriding `content/` must add them; `content.test.ts` fails otherwise).
- Optional: move product pages to `PageHeader`, `EmptyState` and the `components/forms` kit (see the notes example).
- No migration.

### v1.0.0-rc.12 (2026-10-01) — content in serverless functions
- No action needed (`next.config.ts` is starter-owned). Keep runtime-read files under `content/`, or add your folder to `outputFileTracingIncludes`.

### v1.0.0-rc.11 (2026-10-01) — product admin pages
- **Optional:** export `productAdminNav: ProductNavItem[]` from `product/manifest.ts` to add product pages to the admin menu.
  Guard product admin pages/actions with `requireAdmin()` (`app/_lib/admin.ts`) and record changes with `ctx.audit.audited(...)`.
- No migration.

### v1.0.0-rc.10 (2026-10-01) — product context, payments
- **Optional, recommended:** change `product/manifest.ts` to `createProduct(db: Db, ctx: ProductContext)` and build services from
  `ctx` (logger, mail, rate limiter, payments, jobs) instead of calling `getContainer()` in `app/_lib`. The old
  `createProduct(db)` keeps working.
- To run background work, return `jobs: { handlers, periodic }` from `createProduct` and enable the jobs module.
- No migration.

### v1.0.0-rc.9 (2026-10-01) — deployment fixes
- No action needed. On Vercel, setting `NEXT_PUBLIC_SITE_URL` is still recommended (custom domain); without it the production `*.vercel.app` domain is used.

### v1.0.0-rc.8 (2026-10-01) — production hardening
- **Content (add fields):** `error` section in `content/*/marketing.ts` (error page texts).
- **Config:** `seo.defaultOgImage` now defaults to `/api/og`; projects that set their own image keep it. New `seo.dynamicOgImage` (default `true`).
- **Projects with their own rate limiter** (e.g. a booking form using `createMemoryRateLimiter`): switch to
  `getContainer().rateLimiter("<name>", rule)` to use Upstash in production.
- No migration.

### v1.0.0-rc.7 (2026-10-01) — UI kit
- **Content (add fields):** `nav.menu`, `nav.close` in `content/*/marketing.ts` (mobile menu labels).
- **New project-owned file:** `product/layout.tsx` (`ProductLayoutExtras`). If you already render site-wide UI by editing
  `app/[locale]/layout.tsx`, move it into this file and take the starter's layout on merge.
- **Button:** `components/ui/button.tsx` now exports shadcn's `Button`; `ButtonLink` is unchanged.
- **CSS:** `app/globals.css` imports `tw-animate-css` and adds derived tokens; keep the starter version on merge
  (put project CSS in a separate file).
- New dependencies (`radix-ui`, `lucide-react`, `date-fns`, `react-day-picker`, `embla-carousel-react`, `sonner`…): run `pnpm install`.

### v1.0.0-rc.6 (2026-10-01) — blog
- **Content (add fields):** `blog` section in `content/*/app.ts`.
- **New files:** `config/blog.ts` (project-owned), `content/blog/` sample posts (delete them, or keep as a template).
- No migration. The module stays off until `blog: true` in `config/features.ts`.

### v1.0.0-rc.5 (2026-10-01) — V1.2 ops
- **Migration:** starter `0002` creates audit_logs, analytics_events, files. Run `pnpm db:migrate` on a DB copy first.
- **Content (add fields):** `files`, `consent`, `admin` sections and `dashboard.nav.admin` in `content/*/app.ts`.
- **Config:** if your `config/billing.ts` defines its own plans, add `"storage.max_bytes"` to each plan's entitlements.
  New `config/storage.ts` (project-owned): allowed types, max file size.
- **docker-compose.yml:** new `storage` service; integration tests now need it (`pnpm storage:up`).
- Modules stay off until enabled in `config/features.ts`.

### v1.0.0-rc.4 (2026-10-01) — V1.1 SaaS
- **Migration:** starter `0001` creates jobs, access_grants, webhook_events, subscriptions, billing_orders. Run `pnpm db:migrate` on a DB copy first.
- **Content (add fields):** `billing` section in `content/*/app.ts` (see starter's `content/vi/app.ts`).
- **New config:** `config/billing.ts` (project-owned): plans, prices, providers. Modules stay off until enabled in `config/features.ts`.
- **New files:** `vercel.json` (daily cron). If you already had one, merge the `crons` entry.
- **Account deletion** now runs registered hooks first (billing revokes subscriptions).

### v1.0.0-rc.3 (2026-09-30)
- The starter version moved to `.starter-version`; the starter's `package.json` version is fixed at `0.0.0`.
  **One last conflict** on `package.json` `version`: keep yours. Later upgrades will not touch it.
- E2E split: `tests/e2e/starter.spec.ts` (starter-owned, reads texts from `content/`/`config/`) and
  `tests/e2e/site.spec.ts` (yours). If your `site.spec.ts` conflicts, keep ours and delete tests that
  `starter.spec.ts` now covers (hero, locale switch, headers, robots/sitemap, legal, theme, app routes).
- Migrations: none. Content schema: unchanged.

### v1.0.0-rc.2 (2026-09-30)
- **Breaking (content):** `MarketingContent.nav` now only has `switchLocale` — header links moved to `config/navigation.ts`. Remove `nav.features/faq/contact` from `content/*/marketing.ts` and put your links in `config/navigation.ts`.
- **Breaking (content):** `hero.primaryHref` and `hero.secondaryHref` are required (anchor like `"#contact"` or path like `"/tours"`).
- **New project-owned files** (create if missing after the merge): `config/navigation.ts`, `product/home.tsx`, `tests/e2e/server-env.ts`; `product/manifest.ts` must export `sitemapPaths`.
- New: `ContactForm` `defaults` prop; `serializeJsonLd` / `<JsonLd>`; sitemap includes `/terms` and `/privacy`.
- Migrations: none.

### v1.0.0-rc.1 (2026-09-30)
- First release candidate. Nothing to upgrade from.
- Initialize projects with `pnpm init:project`; it writes `starter.lock.json`.
- Starter migrations: `db/migrations/starter/0000_*` (users, sessions, accounts, verifications).
