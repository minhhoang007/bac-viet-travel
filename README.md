# Minh Web App Starter

Reusable Next.js starter for content/service websites (profile `site`) and logged-in web apps (profile `app`).
Small, boring, tested: architecture rules are enforced by tooling, and every optional module is *really off* when disabled.

**Status:** `v1.0.0-rc.1` — foundation, email + contact form, app profile with auth and an example vertical slice.
V1.0 final waits for the reuse proofs in [docs/REUSE-PROOFS.md](docs/REUSE-PROOFS.md). Billing, jobs and usage come in V1.1 ([ROADMAP.md](ROADMAP.md)).

## What you get

| | `site` | `app` |
|---|---|---|
| Next.js 16, TypeScript strict, Tailwind 4 | ✓ | ✓ |
| i18n (vi default at `/`, en at `/en`), SEO (metadata, hreflang, sitemap, robots) | ✓ | ✓ |
| Env validation per profile/module, safe errors, redacting JSON logger, security headers | ✓ | ✓ |
| Contact form (validation, honeypot, rate limit) — module `email` | optional | optional |
| Postgres 18 + Drizzle, Better Auth (magic link, optional Google), roles | | ✓ |
| Dashboard shell, account export/delete, legal page templates | | ✓ |
| Example vertical slice (`product/_example-notes`, ownerId-scoped CRUD) | | ✓ (removable) |

## Requirements

Node ≥ 24, pnpm (via `corepack enable`), Docker (profile `app`: local Postgres + integration tests).

## Setup

```bash
git clone <starter-url> my-project && cd my-project
git remote rename origin starter          # keep starter history for upgrades
pnpm install
pnpm init:project --name "My Project" --profile site --modules email   # or --profile app
cp .env.example .env.local                # fill in what init:project printed
pnpm check
pnpm dev
```

Profile `app` additionally:

```bash
pnpm db:up          # Postgres 18 on localhost:54329
pnpm db:migrate     # starter migrations, then product migrations
pnpm dev            # open /login; with EMAIL_PROVIDER=console the magic link is printed in the server log
```

Details: [docs/SETUP.md](docs/SETUP.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm check` | lint (0 warnings) + typecheck + architecture lint + unit tests (incl. lint-rule fixtures) |
| `pnpm test:int` | integration tests on real Postgres (`minh_test`) |
| `pnpm test:e2e` | Playwright against a production build (`pnpm build` first) |
| `pnpm db:up` / `db:migrate` | local Postgres / run migrations |
| `pnpm db:generate:product` | generate a migration for tables in `product/schema/` |
| `pnpm init:project` | initialize a project (name, profile, modules, remove example) |
| `pnpm verify:init` | clean-clone check of four init variants |

## Deploy

Vercel + Postgres (Neon) + Resend. See [docs/DEPLOY.md](docs/DEPLOY.md).

## Documentation

| File | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, dependency rules, folder map, wiring |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | Rules for AI coding agents |
| [ROADMAP.md](ROADMAP.md) / [REQUIREMENTS.md](REQUIREMENTS.md) | Phases, scope, definitions of done |
| [SECURITY.md](SECURITY.md) / [docs/security/](docs/security/) | Baseline and review reports |
| [docs/UPGRADING.md](docs/UPGRADING.md) | Upgrading a project to a newer starter tag |
| [docs/adr/](docs/adr/) | Architecture decisions |
| [.claude/skills/](.claude/skills/) | Project skills for agents |

## Philosophy

**Create → Configure → Enable Modules → Build Product → Test → Deploy.**
The starter proves its value on the second reuse and the first upgrade, not by feature count.
