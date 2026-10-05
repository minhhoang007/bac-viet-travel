# Reuse proofs (REQUIREMENTS.md §3 — block V1.0)

V1.0 is only tagged when all three are done. Until then, projects use `v1.0.0-rc.N`.

## 1. Two different real projects ✅ (A site, B app — 2026-10-05)

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
| Name / repo | Hạ Long Tours — `D:\dev\halong-tours` (local) | Bắc Việt Travel — `minhhoang007/bac-viet-travel` |
| Starter version | v1.0.0-rc.1 → upgraded to rc.2 (proof 2) | from rc.6 (site), upgraded rc.7 → rc.9 → … → rc.12; now profile app |
| Init command | `pnpm init:project --name "…" --profile site --modules email` | profile app; modules email, blog, jobs, admin |
| Deployed URL | not deployed yet | https://bac-viet-travel.vercel.app (Vercel + Neon + Resend) |

**Project B result (2026-10-05):** tours from MDX, departures with seats, booking with a 15-minute hold, VNPay deposit
(sandbox) confirmed by IPN, guest and team emails, `/admin/bookings` + `/admin/departures` (audited), reminder and
hold-expiry jobs. Product tables in `product/schema/` with product migrations. Real VNPay sandbox payments BV-MK9PF2 and
BV-XK5WCS were confirmed by VNPay's own IPN; the first one (BV-WRRTD2, before the IPN URL was registered at VNPay) was
recovered with querydr, which became G11. Findings G7–G12 below.

**Real deployment proof (2026-10-01):** demo app `minhhoang007/minh-starter-demo` (profile app, example slice, from rc.9) on
https://minh-starter-demo.vercel.app with Neon (pooled) and Resend. Migrations run with `pnpm db:migrate`; `/api/health`
`db: ok`; browser smoke test passed (magic link sign-in, notes create/edit, signed-out note page → login, export 401
anonymous / 200 with the note, account deletion cascades). Found and fixed on the way: site URL fell back to localhost on
Vercel (rc.9). Note: Vercel env vars must be added to the project and the deployment redeployed; until then app routes
fail fast with "Invalid configuration" (logged with a digest).

**Project A2 (site, owner's travel agency — demo stage):** Bắc Việt Travel — `D:\dev\bac-viet-travel` (local), from
`v1.0.0-rc.6`, `--profile site --modules email,blog`. Tours (Hạ Long, Ninh Bình, Sapa) as validated MDX content, booking
inquiry form (team email + visitor confirmation), Zalo / WhatsApp / hotline buttons, 6 blog posts, Unsplash photos.
Result: **2 lines changed in starter-owned files** (`app/[locale]/layout.tsx`); `pnpm check` 101 tests, site E2E 18.
Upgraded **rc.6 → rc.7** (UI kit): 2 conflicts, both predicted by UPGRADING (`app/[locale]/layout.tsx` → take the starter, `product/layout.tsx` → keep the project); after the upgrade the project modifies **no starter-owned file**. axe found one real issue in project code (white text on WhatsApp green, 1.98:1), fixed in the project.

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
| A2 | `app/[locale]/layout.tsx` | G1: no slot for site-wide product UI (floating Zalo/WhatsApp buttons, licence line under the footer); added 2 lines | Yes → `ProductLayoutExtras` slot in `product/layout.tsx` (UI kit release) |
| A2 | (product action) | G2: profile site has no way to wire product services; the inquiry action builds its service from `getContainer().mail` and a **per-instance memory** rate limiter (no Upstash) | Yes → `container.rateLimiter(name, rule)` (rc.8) |
| A2 | `components/layout/site-header.tsx` (not edited) | G3: header links are hidden below `sm` and there is no mobile menu: on phones visitors only reach tours via the hero button | Yes → mobile menu (sheet) in the starter header (UI kit release) |
| A2 | `components/marketing/hero.tsx` (not edited) | G4: hero has no background image; a travel site wants a photo hero (worked around with image cards below) | Yes → optional `image` prop (UI kit release) |
| A2 | (product code) | G5: tours copy the blog's frontmatter/zod/MDX pattern (~60 lines) | Maybe → generic "content collection" helper (schema + folder + locales) shared by blog and products |
| B (Bắc Việt booking) | `app/_lib/booking.ts` | G7: `createProduct(db)` got only the database; services needing a logger/rate limiter were built outside the manifest, and product code could not register jobs | Yes → `ProductContext` + `ProductJobs` (rc.10) |
| B (Bắc Việt booking) | (would copy `providers/billing/vnpay.ts`) | G8: VNPay was reachable only through the subscription billing module; booking deposits are one-time payments | Yes → `container.payments.vnpay` / `ctx.payments` (rc.10) |
| B (Bắc Việt booking) | (would add a second IPN route) | G8b: `ctx.payments.vnpay` built payment URLs, but the only IPN endpoint served billing orders (product orders got `01`); VNPay calls one IPN URL per merchant code | Yes → shared IPN: manifest `vnpayIpn` + `checkVnpayOrder` (rc.15) |
| B (Bắc Việt admin) | `app/[locale]/admin/layout.tsx` (starter-owned) | G9: the admin menu was fixed; product admin pages (bookings, departures) could not be listed without editing a starter file, and product actions had no audit log | Yes → `productAdminNav` + `ctx.audit` (rc.11) |
| B (Bắc Việt deploy) | (none — failed only on Vercel) | G10: dynamic pages reading `content/tours/*.mdx` at request time got an empty catalog (404) because Vercel bundles only imported files; local `next start` hid it | Yes → `outputFileTracingIncludes` for `content/**` (rc.12) |
| B (Bắc Việt payments) | (none — operations) | G11: the IPN URL must be registered by VNPay (merchants cannot set it); until then a paid deposit stayed `pending` and the hold would have expired. Recovered by hand with querydr | Yes → `query()` on the VNPay adapter + `billing.reconcile_vnpay`; products call it before expiring a hold (rc.16) |
| B (Bắc Việt deploy) | (none — production logs) | G12: `/favicon.ico` (and any one-segment path with a dot, e.g. scanner probes) answered 500: it skips `proxy.ts` and reached the home page as the "locale" | Yes → locale check on the home page + brand favicon `app/icon.tsx` (rc.16) |
| A2 | `tests/e2e/server-env.ts` | G6: with the email module on, the production E2E server cannot send (console provider is dev-only), so successful form submissions are only covered by unit tests | Maybe → a test-only mail sink allowed when `E2E=1` |

Lesson from A2: the rc.2 extension points (navigation, home sections, sitemap paths, form defaults, JSON-LD, server env)
removed all of A's edits; the remaining gaps are a **layout slot**, **mobile navigation** and **site-profile services**.

Lesson from A: every finding was a **hard-coded value in a protected file** that a project reasonably wants to change. rc.2 moves each to a project-owned extension point; nothing required changing Core logic or modules.

Outcome: adjust boundaries (move things to config/content/props) for every "yes".

## 2. Upgrade a project across starter tags ✅ (with follow-ups)

**Decision 2026-10-05 (owner):** the "starter migration during an upgrade" step is accepted as covered by automation
instead of a manual run: CI applies every starter + product migration to an empty database (integration global setup,
`e2e-app`), and `pnpm verify:init` runs migrations on fresh clones. No release since rc.10 shipped a starter migration;
the first one that does gets a manual upgrade on a DB copy of project B, recorded here. V1.0 is not blocked on it.

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
