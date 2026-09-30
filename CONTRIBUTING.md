# Contributing

## Branches
- `main`: always releasable, protected.
- `phase/v0.1a-foundation`, `feat/<scope>`, `fix/<scope>`, `upgrade/vX.Y.Z` (in projects).

## Commits
Conventional Commits: `feat(core): ...`, `fix(email): ...`, `docs: ...`, `test(usage): ...`, `chore: ...`.
Breaking change → `feat(core)!:` + entry in `docs/UPGRADING.md`.

## Pull requests
- One phase or one concern per PR.
- Description: what, why, how verified (commands + results), protected paths touched and why.
- `pnpm check` green; CI green including the "no secrets" build.
- Protected paths require maintainer review (CODEOWNERS).

## Releases (starter)
1. Update `CHANGELOG.md` (Keep a Changelog format).
2. Breaking changes documented in `docs/UPGRADING.md` with migration steps.
3. Tag `vX.Y.Z` (SemVer). Pre-releases: `v1.0.0-rc.N`.

## Improvements found in a project
Send back to the starter as a separate PR containing only Core/Modules changes plus tests. Never include product code.

## Agent-authored work
Agents follow [AGENTS.md](AGENTS.md). The human reviewer is responsible for merging.
