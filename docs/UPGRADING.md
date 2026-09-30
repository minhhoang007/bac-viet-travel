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
4. Resolve conflicts. Expected places: `config/*.defaults.ts` (take theirs), `bootstrap/`, `package.json`, lockfile (regenerate).
   Project overrides (`config/*.ts`, `content/`, `product/`, `db/migrations/product/`) should not conflict.
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

_No releases yet._
