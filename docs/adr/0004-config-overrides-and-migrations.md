# ADR-0004: Upgrade-friendly config and split migrations

- Status: **Accepted** (2026-09-30)
- Date: 2026-09-30

## Context
Projects are created by `git clone` (history kept) and upgraded by merging release tags. Two things would conflict on every upgrade:
files every project edits (`config/features.ts`, `brand.ts`) and a shared Drizzle migration folder/journal.

## Decision

### Config
- Starter owns `config/<name>.defaults.ts`. Projects never edit them.
- Projects own `config/<name>.ts`, which imports defaults and overrides:
  ```ts
  // config/features.ts (project-owned)
  import { featureDefaults } from "./features.defaults";
  export const features = { ...featureDefaults, profile: "app", email: true } as const;
  ```
- Same pattern for brand, seo, navigation, billing. `content/` is project-owned.

### Migrations
- `drizzle.starter.config.ts`: `core/**/schema.ts`, `modules/*/schema.ts` → `db/migrations/starter`, table `__starter_migrations`.
- `drizzle.product.config.ts`: `product/schema/*.ts` → `db/migrations/product`, table `__product_migrations`.
- `pnpm db:migrate` runs starter, then product. Product tables may reference starter tables (e.g. `users.id`), never the reverse.
- Starter migrations are generated only inside the starter repo.

### Lock file
`starter.lock.json`: `{ "starterVersion", "initializedAt", "profile", "modules" }`.

## Consequences
- Upgrade conflicts limited mostly to `bootstrap/`, `package.json`, lockfile.
- Verified by reuse proof 36.B-2 before V1.0.
- Alternative if this fails: Copier-style template updates or packaging modules.
