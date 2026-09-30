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

## 2. Upgrade a project across starter tags ⏳

1. Project initialized from `v1.0.0-rc.1`.
2. Starter releases `v1.0.0-rc.2` with at least one Core change and one starter migration.
3. Follow `docs/UPGRADING.md` in the project.

| Step | Result | Conflicts (file → resolution) |
|---|---|---|
| merge tag | | |
| pnpm check / test:int / e2e | | |
| db:migrate on a DB copy | | |

## 3. Minimal configuration ✅ (automated)

All modules off, no secrets → builds, runs, no module endpoints or jobs.

- CI job `build-minimal`: `pnpm build` + E2E with no environment variables.
- E2E: contact form absent; `/login`, `/api/auth/*`, `/api/account/export` → 404 in profile site.
- `pnpm verify:init`: four init variants (site, site+email, app, app+example) each pass `pnpm check` + build (+ integration for app) on a clean clone. Last run: 2026-09-30, all passed.
