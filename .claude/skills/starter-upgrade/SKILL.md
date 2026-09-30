---
name: starter-upgrade
description: Upgrade a project to a newer Minh Web App Starter tag, or send a project improvement back to the starter. Use when asked to upgrade the starter or upstream a Core/Modules change.
---

# Starter upgrade

## Upgrade a project
Follow `docs/UPGRADING.md` exactly. Summary:
1. Read `starter.lock.json` → current version. Read CHANGELOG + UPGRADING notes for every tag up to the target.
2. `git fetch starter --tags && git checkout -b upgrade/vX.Y.Z && git merge vX.Y.Z`.
3. Conflicts: `config/*.defaults.ts` take starter's; project overrides/`product/`/`content/` keep ours; regenerate lockfile.
   Anything else: explain the conflict and proposed resolution before resolving.
4. `pnpm install && pnpm check && pnpm test:int && pnpm test:e2e`.
5. Migrations only against a DB copy; never production from the agent.
6. Update `starter.lock.json`; PR description lists every conflict and how it was resolved.

## Upstream an improvement
- Separate branch/PR in the starter repo containing only Core/Modules/docs + tests.
- Remove all product-specific names, content and assumptions.
- Add CHANGELOG entry; breaking → UPGRADING note.
