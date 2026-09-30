---
name: phase-execution
description: How to implement one ROADMAP.md phase (e.g. V0.1a, V0.2) end to end — plan, confirm, build task by task with evidence, stop at the phase boundary. Use when asked to implement or continue a roadmap phase.
---

# Phase execution

## 1. Load context
Read, in order: `AGENTS.md`, the phase section in `ROADMAP.md`, relevant parts of `ARCHITECTURE.md`,
`REQUIREMENTS.md`, and any ADR the phase depends on. If a needed ADR is still *Proposed*, ask before relying on it.

## 2. Plan and confirm (no code yet)
Reply with:
- Tasks from the roadmap table, each with the files you will create and the verification from the "Kiểm chứng" column.
- Assumptions and open questions.
- Anything in the phase you think is unnecessary or wrong.
Wait for approval.

## 3. Build
- One roadmap task at a time, smallest working increment, tests with the task.
- After each task: run the task's verification and `pnpm check`. Fix before moving on.
- Do not start work belonging to a later phase, even if "it's easy now". Note it instead.
- Follow `karpathy-guidelines`.

## 4. Report
```
Phase <id> — status
| # | Task | Status | Evidence (command → result) |
Deviations from docs: ...
Protected paths touched and why: ...
Follow-ups for later phases: ...
```
Update the task checkboxes/status in ROADMAP.md and add a CHANGELOG `[Unreleased]` entry.

## 5. Stop
End at the phase boundary. The human reviews before the next phase.
