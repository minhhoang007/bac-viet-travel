---
name: karpathy-guidelines
description: Behavioral guidelines for every coding task in this repo — think before coding, simplest solution, surgical changes, goal-driven verification. Use on any task that writes, edits or reviews code.
---

# Karpathy-style coding guidelines

Inspired by Andrej Karpathy's observations on common LLM coding failures (silent assumptions, overcomplication,
drive-by edits, unverifiable "done"). Adapted for Minh Web App Starter. These bias toward caution over speed;
for trivial tasks, use judgment.

## 1. Think before coding
- State assumptions explicitly. If uncertain, ask.
- If there are several interpretations, present them — do not pick one silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear or conflicts with AGENTS.md / ARCHITECTURE.md, stop, name the conflict, ask.

## 2. Simplicity first
- Minimum code that solves the stated problem. Nothing speculative.
- No features beyond the request or phase. No abstraction for single-use code.
- No "flexibility" or configurability that was not requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.
- Test: would a senior engineer call this overcomplicated? Then simplify.

## 3. Surgical changes
- Touch only what the task requires. Do not "improve" adjacent code, comments or formatting.
- Do not refactor what is not broken. Match existing style.
- Unrelated dead code: mention it, do not delete it.
- Remove only imports/variables/functions that *your* change made unused.
- Every changed line must trace to the request.
- In this repo: protected paths (see AGENTS.md) need an explicit justification before any edit.

## 4. Goal-driven execution
Turn tasks into verifiable goals:
- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → tests pass before and after.

For multi-step work, state a brief plan first:
```
1. <step> → verify: <check>
2. <step> → verify: <check>
```
Loop until verified. `pnpm check` green is the minimum bar; "should work" is not evidence.

## Signs it is working
Smaller diffs, fewer rewrites caused by overcomplication, clarifying questions *before* implementation, and every "done" backed by a command and its output.
