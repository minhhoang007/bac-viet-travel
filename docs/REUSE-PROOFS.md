# Reuse proofs (REQUIREMENTS.md §3 — block V1.0)

V1.0 is only tagged when all three are done. Until then, projects use `v1.0.0-rc.N`.

## 1. Two different real projects ⏳

| | Project A (site) | Project B (app) |
|---|---|---|
| Name / repo | | |
| Starter version | | |
| Init command | `pnpm init:project --name "…" --profile site --modules email` | `pnpm init:project --name "…" --profile app` |
| Deployed URL | | |

**Every edit to Core/Modules/bootstrap/components (the protected paths) needed by the project:**

| Project | File | Why | Belongs in starter? (PR link) |
|---|---|---|---|
| | | | |

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
