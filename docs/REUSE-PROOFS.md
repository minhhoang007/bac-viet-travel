# Reuse proofs (REQUIREMENTS.md §3 — block V1.0)

V1.0 is only tagged when all three are done. Until then, projects use `v1.0.0-rc.N`.

## 1. Two different real projects 🟨 (A done, B pending)

| | Project A (site) | Project B (app) |
|---|---|---|
| Name / repo | Hạ Long Tours — `D:\dev\halong-tours` (local) | |
| Starter version | v1.0.0-rc.1 → upgraded to rc.2 (proof 2) | |
| Init command | `pnpm init:project --name "…" --profile site --modules email` | `pnpm init:project --name "…" --profile app` |
| Deployed URL | not deployed yet | |

**Every edit to Core/Modules/bootstrap/components (the protected paths) needed by the project:**

| Project | File | Why | Belongs in starter? |
|---|---|---|---|
| A | `components/marketing/contact-form.tsx` | F1: booking form must be prefilled with the tour name; no way to pass default values | Yes → `defaults` prop (rc.2) |
| A | `app/[locale]/layout.tsx` | F2: header links (Features/FAQ/Contact) hard-coded; needed "Tours" | Yes → `config/navigation.defaults.ts` + project `config/navigation.ts` (rc.2) |
| A | `app/[locale]/page.tsx` | F3: no slot for product sections on the home page (featured tours) | Yes → `product/home.tsx` `ProductHomeSections` (rc.2) |
| A | (product code) | F4: no JSON-LD helper although the design promised one; product wrote its own escaping | Yes → `serializeJsonLd` + `<JsonLd>` (rc.2) |
| A | `app/sitemap.ts` | F5: sitemap paths hard-coded; tour pages missing | Yes → `sitemapPaths` in `product/manifest.ts` (rc.2) |
| A | `app/[locale]/page.tsx` | F6: hero buttons hard-coded to `#contact` / `#features`; needed `/tours` | Yes → `hero.primaryHref` / `secondaryHref` in content (rc.2) |
| A | `playwright.config.ts` | F7: E2E server env (email module on) not configurable | Yes → project-owned `tests/e2e/server-env.ts` (rc.2) |

Lesson from A: every finding was a **hard-coded value in a protected file** that a project reasonably wants to change. rc.2 moves each to a project-owned extension point; nothing required changing Core logic or modules.

Outcome: adjust boundaries (move things to config/content/props) for every "yes".

## 2. Upgrade a project across starter tags ✅ (with follow-ups)

1. Project initialized from `v1.0.0-rc.1`.
2. Starter releases `v1.0.0-rc.2` with at least one Core change and one starter migration.
3. Follow `docs/UPGRADING.md` in the project.

Done 2026-09-30 on Hạ Long Tours (profile site): `v1.0.0-rc.1` → `v1.0.0-rc.2`. rc.2 had no migrations, so the DB step is still unproven (repeat with an app-profile project and a starter migration).

| Step | Result | Conflicts (file → resolution) |
|---|---|---|
| `git merge v1.0.0-rc.2` | 7 conflicts, **all in project-owned files**; no Core/Modules/bootstrap conflict | `config/navigation.ts`, `product/home.tsx`, `tests/e2e/server-env.ts` (add/add) → ours · `content/{vi,en}/marketing.ts` (hero) → ours · `product/manifest.ts` (`sitemapPaths`) → ours · `package.json` (name/version) → ours |
| auto-merged | `tests/e2e/site.spec.ts`: the starter's new E2E test was merged into the project's test file | kept (it passed) |
| `pnpm check` / build / `test:e2e` | green: 60 unit, 25 pages, 14 E2E | — |
| `db:migrate` on a DB copy | n/a (no migrations in rc.2) | — |

**Lessons → follow-ups for rc.3**

| # | Observation | Follow-up |
|---|---|---|
| U1 | add/add conflicts happened because the project created the extension-point files before the starter shipped them | One-off for this project; future projects get them at init. Note in UPGRADING: "project-owned file added by both sides → keep ours" |
| U2 | Starter releases that edit default `content/` text conflict with every project (content is project-owned) | Rule: releases change `content/` only by adding fields; UPGRADING lists new fields to add by hand |
| U3 | `package.json` `name`/`version` conflict on every upgrade (init changes name, releases bump version on adjacent lines) | Keep the starter version out of `package.json` (e.g. `.starter-version`); init sets the project's own version |
| U4 | Starter E2E tests live in the same file projects edit, and they assert starter text | Split: starter-owned `tests/e2e/starter.spec.ts` reading texts from `content/` (content-agnostic), project-owned `site.spec.ts` |

## 3. Minimal configuration ✅ (automated)

All modules off, no secrets → builds, runs, no module endpoints or jobs.

- CI job `build-minimal`: `pnpm build` + E2E with no environment variables.
- E2E: contact form absent; `/login`, `/api/auth/*`, `/api/account/export` → 404 in profile site.
- `pnpm verify:init`: four init variants (site, site+email, app, app+example) each pass `pnpm check` + build (+ integration for app) on a clean clone. Last run: 2026-09-30, all passed.
