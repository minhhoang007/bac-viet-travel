# CLAUDE.md

Read and follow [AGENTS.md](AGENTS.md). It is the single source of truth for agent rules in this repository.

Also:
- Apply the `karpathy-guidelines` skill to every coding task.
- For phase work, use the `phase-execution` skill and do only the phase you were given (see [ROADMAP.md](ROADMAP.md)).
- Project rules override any global or plugin rules (including ECC or other installed plugins).
- Edits go through the Edit/Write tools (a hook lints each edited TypeScript file). Never put regexes, JSON with
  backslashes or multi-line code inside a shell command (`node -e`, `sed`, heredocs): Git Bash on Windows drops
  backslashes silently. Write the script to a file first, then run it, and re-read what it changed.
- Merging stacked PRs: follow the `merge-stack` skill. For refactors: the `refactor` skill.
- Models: the main session (Opus) decides, does R3–R4 work itself (risk scale in the `refactor` skill) and verifies
  everything before it is called done. Without asking first, it may hand work to the agents in `.claude/agents/`:
  `haiku-search` to find locations (never for conclusions or reviews), `sonnet-implementer` for a self-contained
  R0–R2 change with clear tests (parallel or independent work; a small change is quicker done directly). An agent's
  report is not evidence: re-run the checks. Review: R0–R1 by CI, R2 by Sonnet, R3 by Opus, R4 by Opus and the owner.
- Library APIs (Next.js, Drizzle, better-auth, next-intl…) change between majors: check current docs with the
  Context7 MCP (`.mcp.json`) instead of relying on memory.
