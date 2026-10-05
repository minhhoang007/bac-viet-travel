---
name: systematic-debugging
description: Root-cause-first debugging for failing tests, build/type errors, E2E flakes and production bugs. Use before proposing any fix for a bug or unexpected behavior.
---

# Systematic debugging

Adapted from obra/superpowers (`systematic-debugging`, MIT) for Minh Web App Starter.

**Rule: no fix before the root cause is found.** A symptom fix is a failed debug.

## 1. Investigate
- Read the whole error and stack trace, including warnings above it.
- Reproduce it reliably with the smallest command: `pnpm vitest run <file>`, `pnpm test:int <file>`,
  `pnpm playwright test <spec> -g "<name>"`, `pnpm typecheck`, `pnpm arch`.
- Check what changed: `git diff`, `git log -5 --stat`, new deps in `pnpm-lock.yaml`, env/config changes.
- Find which layer breaks: route/action → service (`getContainer()`) → repository/DB → provider. Check the value
  at each boundary instead of guessing. Remove temporary logs afterwards; never log secrets or personal data.
- Trace a bad value back to where it was produced.

## 2. Compare
- Find similar code that works (another module, another route, the starter's own tests) and list every difference.
- Read the reference fully. For Next.js behavior, read `node_modules/next/dist/docs/` — not memory.

## 3. Hypothesis
- One specific hypothesis, stated with its reason.
- Smallest change that tests it; one variable at a time.
- Wrong? Revert it and form a new hypothesis. Do not stack fixes.

## 4. Fix
- Write a failing test that reproduces the bug (critical flows: follow `tdd-critical-flows`).
- One fix at the root cause, then the test and `pnpm check` pass.
- **3 failed fixes → stop.** Report findings and question the design with the user instead of a 4th attempt.

## Stop signals
- "Quick fix now, investigate later", "just try X and see".
- A fix proposed before the data flow was traced.
- Each fix reveals a new problem somewhere else.
- The user asks "are you sure?", "stop guessing", "are we stuck?" → go back to step 1.

Never weaken an assertion, add a skip or raise a timeout to make red go green
without explaining the root cause.
