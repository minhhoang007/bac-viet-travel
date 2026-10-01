---
name: product-feature
description: Build a product feature inside a project created from the starter — schema, service, validation, action, UI, tests — without touching Core/Modules. Use when adding app-specific functionality.
---

# Product feature

Use `product/_example-notes/` as the reference implementation.

## Placement
| Piece | Location |
|---|---|
| Table | `product/schema/<feature>.ts` (has `id` UUIDv7, `ownerId`, `createdAt`, `updatedAt`) |
| Migration | `pnpm db:generate:product` → `db/migrations/product/` (never edit existing ones) |
| Input schemas | `product/validations/<feature>.ts` (zod) |
| Business logic + DB | `product/services/<feature>.ts` (Drizzle allowed here) |
| Server actions | `product/actions/<feature>.ts` — thin: `auth.requireUser()` → validate → service |
| UI | `product/components/**`, routes in `app/dashboard/product/**` or `app/(product)/**` |
| Menu / job handlers / periodic tasks | `product/manifest.ts` — `createProduct(db, ctx)`: build services from `ctx` (logger, mail, `rateLimiter`, `payments`, `jobs`); return `jobs: { handlers, periodic }` |
| Strings | `content/` |
| Tests | `product/tests/` |

## Rules
- Every query on user data filters by `ownerId` from the session, never from client input.
- Use modules only through `modules/<name>/index.ts` and only if enabled (check `features` or handle `MODULE_DISABLED`).
- Need something Core/Modules lacks? Stop and propose it: it may belong in the starter (separate PR) instead of product.

## Required tests
- Happy path for each action.
- Validation rejects bad input.
- **IDOR:** user B cannot read/update/delete user A's records.
- Unauthenticated access is rejected.
