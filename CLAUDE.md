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
- Library APIs (Next.js, Drizzle, better-auth, next-intl…) change between majors: check current docs with the
  Context7 MCP (`.mcp.json`) instead of relying on memory.
