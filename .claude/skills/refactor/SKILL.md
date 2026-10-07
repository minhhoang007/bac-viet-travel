---
name: refactor
description: How to refactor safely in a starter-based project — scan, pick what the next change needs, score risk R0–R4, small verified commits, stop at R4 for the owner. Use when asked to refactor, clean up, reduce duplication or split large files.
---

# Refactor

Refactor to make the **next change easy**, not to make code "clean". Behaviour stays the same; any behaviour change
is a separate commit with its own test.

## 1. Scan (read-only)
- `pnpm knip` (unused files/deps) and `pnpm knip:exports` (unused exports; `product/manifest.ts` exports read through
  `import * as manifest` are false positives).
- `pnpm dup` (copy-paste), `pnpm lint` (the `max-lines` budget).
- Hotspots: files changed most often in the last 90 days, then their size:
  `git log --since=90.days --name-only --format= | sort | uniq -c | sort -rn | head -20`.
- Blast radius of a file: `pnpm exec depcruise <dirs> --config .dependency-cruiser.cjs --reaches "<path>"` and
  `pnpm exec vitest related <path> --run`.

## 2. Choose
Pick only items that (a) duplicate *knowledge* (a business rule written twice), or (b) sit in a hotspot that the next
feature touches. Leave large files nobody changes. Two similar UI blocks are fine until the third copy.

## 3. Score each item

| Level | Examples | Rule |
|---|---|---|
| R0 | unused export/file/dependency | may be done autonomously |
| R1 | extract a function, split a component, rename inside one file | tests must exist and stay green |
| R2 | move files, change imports, split a service | + blast radius checked, all suites green |
| R3 | crosses features (booking ↔ tours, auth ↔ users) | + written plan, one batch per commit |
| R4 | money, payments, seat/stock locks, auth, permissions, schema | + integration tests on failure paths first; **never merged without the owner** |

## 4. Change in small batches
- One idea per commit (`refactor(<area>): …`), each passing `pnpm check` (and `pnpm test:int` for R2+, E2E for UI).
- Mechanical edits across many files: use an AST script (ts-morph) or the editor's rename, not regex search/replace.
  On Windows Git Bash, write scripts to files and keep regex backslashes out of shell strings.
- Business rules get one home (a pure module) with a unit test; callers use it. Prefer tables + `satisfies Record<…>`
  so a new case fails to compile until handled.
- Schema changes: expand → migrate data → switch reads → contract, never in one step.

## 5. Finish
- Re-run the scan: no new knip/dup findings, no file over the budget.
- PR description: items done, risk level of each, what was deliberately left, test results.
- Keep work in progress small: do not stack new refactor PRs on an unmerged chain.
