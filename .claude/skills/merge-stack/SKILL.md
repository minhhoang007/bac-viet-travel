---
name: merge-stack
description: How to merge a chain of stacked PRs (each PR based on the previous one's branch) safely — migrations first, retarget before deleting branches, CI green per PR, flaky reruns, production check. Use when asked to merge several dependent PRs or "the chain".
---

# Merge a PR stack

Avoid stacks: keep at most ~3 open PRs. When a stack exists anyway, merge it in base order, one PR at a time.

## 1. Before the first merge
- List the chain: `gh pr list --state open --json number,headRefName,baseRefName` and order it from `main` upward.
- Migrations: list which PR adds which file in `db/migrations/product/`. Additive migrations (new table, nullable
  column, column with a default) may all run before the first merge; anything else runs right before its PR. Run
  them on production only with the command the owner allowed, from a checkout that contains them.
- Ask the owner before the run if they have not approved this merge in this conversation.

## 2. For each PR, in order
1. `gh pr edit <n> --base main` (CI only runs for PRs targeting `main`).
2. Trigger CI: `gh pr close <n> && gh pr reopen <n>` (retargeting alone does not start a run).
3. Find the new run (`gh run list --branch <head> --workflow CI`, created after the trigger) and
   `gh run watch <id> --exit-status`.
4. Red: read `gh run view <id> --log-failed`. Timeouts on page loads are usually runner flakiness: rerun failed jobs
   (`gh run rerun <id> --failed`) at most twice. The same test failing every time is a real failure: stop and fix it.
5. Check all checks are `pass` (`gh pr checks <n>`), then merge in a separate step: `gh pr merge <n> --merge`
   (**without** `--delete-branch`).
6. Retarget its children to `main` right away: `gh pr list --base <head>` → `gh pr edit <child> --base main`.
   Deleting a base branch while a PR still targets it **closes** that PR (GitHub does not retarget it); a closed
   PR cannot be reopened until the branch is restored (`gh api repos/<o>/<r>/git/refs -f ref=refs/heads/<b> -f sha=<old head>`).

## 3. After the last merge
- Delete the merged branches (`git push origin --delete <b>`).
- Production: wait for the deploy of `main`, then load the main pages and API routes (status 200, no errors).
- Leave PRs that need the owner (risk R4) open, based on `main`, and say so.

A long chain can run as a background script that does the steps above and stops on the first real failure; follow
it with a log monitor and report each merge.
