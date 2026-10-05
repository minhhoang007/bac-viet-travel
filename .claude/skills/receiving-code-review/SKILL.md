---
name: receiving-code-review
description: How to act on review feedback (human, PR comments, /code-review findings, security review) — verify each item against the code before changing anything. Use when applying review findings.
---

# Receiving code review

Adapted from obra/superpowers (`receiving-code-review`, MIT) for Minh Web App Starter.

**Verify before implementing. Technical correctness over agreement.**

## Steps
1. Read all items first. Restate each one as a concrete requirement.
2. Unclear item → ask before changing anything; items are often related.
3. Verify each item against the real code: does the scenario actually happen? Read the code path, or reproduce it
   with a test.
4. Evaluate it against this repo's rules (AGENTS.md, ARCHITECTURE.md, protected paths, module contract).
   A suggestion that breaks a rule is wrong here even if it is good in general.
5. Classify: **fix** / **push back** (with technical reason) / **out of scope** (note for a later phase).
6. Fix one item at a time; add or adjust a test where the item is a bug; run `pnpm check` at the end.

## Rules
- No performative agreement ("You're absolutely right!"). Report facts: "Fixed: <what>, in <file>."
- Push back with evidence when a finding is wrong (file, line, test output).
- YAGNI: a request for a "proper/complete" implementation → grep for real usage first. Unused → do not build it.
- Do not silently skip an item: every item ends as fixed, rejected with reason, or deferred.
- Protected-path edits still need the justification required by AGENTS.md.
