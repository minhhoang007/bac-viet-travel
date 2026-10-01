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

### Next release (blog, unreleased)
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
