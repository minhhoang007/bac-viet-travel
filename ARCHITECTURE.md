# Architecture

Design baseline: v2.1 design document + fixes in [docs/DESIGN-CHANGES-v2.2.md](docs/DESIGN-CHANGES-v2.2.md).

## 1. Layers

```text
┌────────────────────────────────────────────────┐
│ PRODUCT   product/                             │  free — agents work here
├────────────────────────────────────────────────┤
│ MODULES   modules/                             │  optional, enabled per project
│ email │ jobs │ entitlements │ billing │ usage  │
│ storage │ analytics │ admin │ ai │ blog       │
├────────────────────────────────────────────────┤
│ CORE      core/  components/  config/  db/     │  protected, stable
└────────────────────────────────────────────────┘
      bootstrap/  +  providers/  +  app/           wiring layer
```

## 2. Profiles

| Profile | Includes | Secrets required |
|---|---|---|
| `site` | UI, content, SEO, contact form, env validation, logging | Email provider (if contact form on). Redis optional — in-memory rate limit fallback. **No DB/auth secrets.** |
| `app` | site + DB, auth, users, `ownerId`, account, dashboard | site + `DATABASE_URL`, auth secrets. Email required when magic link is on. |

## 3. Dependency rules

1. Product → Modules (public API) → Core. Never the reverse.
2. Core imports nothing from `modules/`, `product/`, `providers/`, `bootstrap/`. Needs are declared as ports in `core/ports/`.
3. Modules import no `product/`, `providers/`, `bootstrap/`. Other modules only via `index.ts` and only if in `requires`/`uses`.
4. `providers/` imported only by `bootstrap/`.
5. Vendor SDKs only in `providers/**` and `core/auth/adapters/**`. DB drivers only in `db/**`.
6. `drizzle-orm` allowed in schema, repository, service files; forbidden in `app/`, `components/`, `product/components/`, `product/actions/`.
7. No cycles.
8. `bootstrap/` is the only place importing Core + Modules + providers + `product/manifest.ts`.

Enforced by dependency-cruiser + `scripts/check-module-deps.ts` + `tests/arch-fixtures/` (see §8).

## 4. Folder map and edit rights

| Path | Layer | Rights |
|---|---|---|
| `core/**` (incl. `core/auth/adapters/`) | Core | Protected |
| `components/{ui,layout,marketing,dashboard}` | Core | Protected (customize via props/config) |
| `app/**` except product routes | Wiring | Protected |
| `bootstrap/**` | Wiring | Protected, small |
| `providers/**` | Wiring | Add/replace adapters |
| `modules/**` | Modules | Protected; change with reason + tests |
| `config/*.defaults.ts` | Core | Protected (starter-owned) |
| `config/*.ts` (overrides), `content/**` | Project | Edit at project init |
| `db/migrations/starter/` | Core | Starter-owned, add-only |
| `db/migrations/product/` | Product | Project-owned, add-only |
| `product/**`, `app/dashboard/product/**`, `app/(product)/**` | Product | Free |
| `tests/**` | — | Add freely; never delete Core/Modules tests |

## 5. Repository layout

```text
app/            (marketing) (auth) (product) dashboard/product admin api
bootstrap/      container.ts env.ts navigation.ts
core/           ports module auth(adapters, schema) users security validation errors logger env seo
components/     ui layout marketing dashboard
modules/<name>/ module.ts index.ts ports.ts service.ts repository.ts schema.ts tests/
providers/      billing email storage analytics ai jobs
product/        manifest.ts components services actions schema validations tests _example-notes
config/         *.defaults.ts (starter) + *.ts (project overrides)
content/        marketing.ts ...
db/             client.ts migrations/{starter,product} seed/
tests/          e2e integration arch-fixtures
scripts/        check-module-deps.ts init-project.ts
docs/           adr UPGRADING.md SETUP.md
```

## 6. Wiring: bootstrap and ports

- Core/Modules declare needs as interfaces (`MailPort`, `AnalyticsPort`, …) with no-op defaults.
- `bootstrap/container.ts` builds services lazily and caches them: `getContainer()`.
- `bootstrap/env.ts` validates base env + env of enabled modules only.
- `bootstrap/navigation.ts` builds menus from enabled module manifests.
- Startup checks fail fast on: missing `requires`, wrong profile, `app` + magic link without `email`.
- `bootstrap/` contains no business logic.

## 7. Module lifecycle ("really off")

When a module is off:
1. No secrets required.
2. Build succeeds without its secrets (lazy init).
3. Its routes/pages/actions return 404 via `assertModuleEnabled`; its factory throws `MODULE_DISABLED`.
4. Its jobs/sweepers are not registered; its menu items are hidden.

Schemas of all modules are always migrated in `app` profile (empty tables when off).

## 8. Enforcement layers

1. dependency-cruiser rules in CI.
2. `check-module-deps.ts`: `requires`/`uses` vs actual import graph.
3. `tests/arch-fixtures/`: intentional violations; test asserts each rule fires.
4. CODEOWNERS on protected paths.
5. (Optional, dev-time only) Claude Code hooks — fast feedback, never a replacement for CI.

`pnpm check` = lint + typecheck + arch lint + module-deps + fixtures test + unit tests.

## 9. Data flow

```text
Route / Server Action (thin: guard → validate → service)
  → Service (module or product/services)
    → Repository / Provider (wired by bootstrap)
      → Database / external service
```

## 10. Migrations

Two Drizzle configs, two folders, two journal tables:

| Config | Schema globs | Out | migrationsTable |
|---|---|---|---|
| `drizzle.starter.config.ts` | `core/**/schema.ts`, `modules/*/schema.ts` | `db/migrations/starter` | `__starter_migrations` |
| `drizzle.product.config.ts` | `product/schema/*.ts` | `db/migrations/product` | `__product_migrations` |

`pnpm db:migrate` runs starter first, then product. See [ADR-0004](docs/adr/0004-config-overrides-and-migrations.md).
