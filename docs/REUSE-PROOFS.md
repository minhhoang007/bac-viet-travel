# Reuse proofs (REQUIREMENTS.md §3 — block V1.0)

V1.0 is only tagged when all three are done. Until then, projects use `v1.0.0-rc.N`.

## 1. Two different real projects 🟨 (A done, B pending)

**Project B = your real app project** (decision 2026-09-30). While building it:

1. Start from the latest tag: `git clone --branch v1.0.0-rc.3 D:\dev\minh-starter <project>` → `git remote rename origin starter`
   → `pnpm init:project --name "…" --profile app`.
2. Every time you (or an agent) must edit a **protected path** (`core/`, `modules/`, `components/`, `bootstrap/`, `app/` outside
   product routes, `*.defaults.ts`, `tests/e2e/starter.spec.ts`), add a row to the findings table below: file, why, what
   extension point would have avoided it.
3. Add at least one table in `product/schema/` + `pnpm db:generate:product` + `pnpm db:migrate`.
4. When the starter ships a release with a **starter migration**, upgrade the project (docs/UPGRADING.md) on a DB copy
   and fill in proof 2's migration row.
5. Findings go back to the starter as a separate PR (CONTRIBUTING: "Improvements found in a project").

| | Project A (site) | Project B (app) |
|---|---|---|
| Name / repo | Hạ Long Tours — `D:\dev\halong-tours` (local) | |
| Starter version | v1.0.0-rc.1 → upgraded to rc.2 (proof 2) | |
| Init command | `pnpm init:project --name "…" --profile site --modules email` | `pnpm init:project --name "…" --profile app` |
| Deployed URL | not deployed yet | |

**Project A2 (site, owner's travel agency — demo stage):** Bắc Việt Travel — `D:\dev\bac-viet-travel` (local), from
`v1.0.0-rc.6`, `--profile site --modules email,blog`. Tours (Hạ Long, Ninh Bình, Sapa) as validated MDX content, booking
inquiry form (team email + visitor confirmation), Zalo / WhatsApp / hotline buttons, 6 blog posts, Unsplash photos.
Result: **2 lines changed in starter-owned files** (`app/[locale]/layout.tsx`); `pnpm check` 101 tests, site E2E 18.

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
| A2 | `app/[locale]/layout.tsx` | G1: no slot for site-wide product UI (floating Zalo/WhatsApp buttons, licence line under the footer); added 2 lines | Yes → `ProductLayoutExtras` slot in `product/layout.tsx` (like `ProductHomeSections`) |
| A2 | (product action) | G2: profile site has no way to wire product services; the inquiry action builds its service from `getContainer().mail` and a **per-instance memory** rate limiter (no Upstash) | Yes → expose `rateLimiterFor(rule)` (or product services for profile site) from the container |
| A2 | `components/layout/site-header.tsx` (not edited) | G3: header links are hidden below `sm` and there is no mobile menu: on phones visitors only reach tours via the hero button | Yes → mobile menu (disclosure) in the starter header |
| A2 | `components/marketing/hero.tsx` (not edited) | G4: hero has no background image; a travel site wants a photo hero (worked around with image cards below) | Yes → optional `image` prop |
| A2 | (product code) | G5: tours copy the blog's frontmatter/zod/MDX pattern (~60 lines) | Maybe → generic "content collection" helper (schema + folder + locales) shared by blog and products |
| A2 | `tests/e2e/server-env.ts` | G6: with the email module on, the production E2E server cannot send (console provider is dev-only), so successful form submissions are only covered by unit tests | Maybe → a test-only mail sink allowed when `E2E=1` |

Lesson from A2: the rc.2 extension points (navigation, home sections, sitemap paths, form defaults, JSON-LD, server env)
removed all of A's edits; the remaining gaps are a **layout slot**, **mobile navigation** and **site-profile services**.

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
| U1 | add/add conflicts happened because the project created the extension-point files before the starter shipped them | ✅ rc.3: UPGRADING conflict table ("added by both sides → keep ours") |
| U2 | Starter releases that edit default `content/` text conflict with every project (content is project-owned) | ✅ rc.3: release rules in CONTRIBUTING (content: add fields only) |
| U3 | `package.json` `name`/`version` conflict on every upgrade (init changes name, releases bump version on adjacent lines) | ✅ rc.3: `.starter-version`; `package.json` version fixed at `0.0.0`, init sets `0.1.0` |
| U4 | Starter E2E tests live in the same file projects edit, and they assert starter text | ✅ rc.3: content-agnostic `tests/e2e/starter.spec.ts` + project-owned `site.spec.ts` |

**Second upgrade rc.2 → rc.3 (2026-09-30):** exactly the 2 conflicts announced in the rc.3 notes
(`package.json` version, `tests/e2e/site.spec.ts`), both resolved with "ours" per the conflict table.
Result: 60 unit, 25 pages, 15 E2E (10 starter-owned generic + 5 project) green. From rc.3 on, neither file
should conflict again — to be confirmed by the next upgrade.

## 3. Minimal configuration ✅ (automated)

All modules off, no secrets → builds, runs, no module endpoints or jobs.

- CI job `build-minimal`: `pnpm build` + E2E with no environment variables.
- E2E: contact form absent; `/login`, `/api/auth/*`, `/api/account/export` → 404 in profile site.
- `pnpm verify:init`: four init variants (site, site+email, app, app+example) each pass `pnpm check` + build (+ integration for app) on a clean clone. Last run: 2026-09-30, all passed.
