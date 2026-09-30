# ADR-0003: Agent tooling (Claude Code, Codex, Cursor, ECC)

- Status: **Accepted** (2026-09-30)
- Date: 2026-09-30

## Context
Agents write much of the code. Architecture rules must mean one thing. External toolkits such as ECC
(affaan-m/ecc: ~68 agents, ~290 skills, ~90 commands, hooks, MCP configs; single maintainer, weekly releases)
add useful workflows but also broad, generic rules, context bloat, version churn and Windows caveats.

## Decision
1. **Source of truth in repo:** `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`. Versioned with starter tags.
2. **Precedence:** project rules override any global/plugin rules (stated at the top of AGENTS.md).
3. **External toolkits:** user-level only, never committed; minimal profile; pinned version.
   From ECC keep only TDD, code-review, security-review, planner, common + TypeScript rules.
4. **Useful external skills are vendored**, adapted and attributed (MIT) into `.claude/skills/` so behavior is reproducible across projects.
5. **Disabled:** continuous-learning / auto-generated rules, memory vault, MCP servers not in ADR-0001.
6. **Hooks:** only hooks whose code has been read. Hooks give fast feedback; CI (`pnpm check`) is the gate.
7. **Candidate project hooks (V0.1b+):** block edits to existing migrations; warn on protected-path edits; remind to run `pnpm check` before finishing.

## Consequences
- Agents behave the same in every project built from the same starter tag.
- Upgrading external toolkits is a deliberate change recorded here.
