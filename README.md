# Minh Web App Starter

Reusable Next.js starter for content sites (`site` profile) and logged-in web apps (`app` profile).

> **Status: design phase — no code yet.** This repository currently contains only documentation.
> Implementation starts with phase V0.1a in [ROADMAP.md](ROADMAP.md).

## Documents

| File | Purpose | Audience |
|---|---|---|
| [ROADMAP.md](ROADMAP.md) | Phases, tasks, exit criteria | You + agents |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, dependency rules, folder map | Everyone |
| [AGENTS.md](AGENTS.md) | Rules for AI coding agents | Claude Code, Codex, Cursor |
| [CLAUDE.md](CLAUDE.md) | Claude Code entry point (points to AGENTS.md) | Claude Code |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Scope table and V1.0 requirements | You |
| [SECURITY.md](SECURITY.md) | Security baseline | Everyone |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, PRs, releases | You + agents |
| [docs/SETUP.md](docs/SETUP.md) | Local machine + agent tooling setup | You |
| [docs/UPGRADING.md](docs/UPGRADING.md) | Upgrading a project to a newer starter tag | You |
| [docs/DESIGN-CHANGES-v2.2.md](docs/DESIGN-CHANGES-v2.2.md) | Fixes to the v2.1 design | You |
| [docs/adr/](docs/adr/) | Architecture decisions | Everyone |
| [.claude/skills/](.claude/skills/) | Project skills for agents | Agents |

## Philosophy

**Create → Configure → Enable Modules → Build Product → Test → Deploy**

Small, stable, boring, tested, documented. The starter proves its value on the *second* reuse and the *first* upgrade, not by feature count.

## Quick start (after V0.1a exists)

```bash
git clone <starter-url> my-project && cd my-project
git remote rename origin starter
pnpm install
cp .env.example .env.local
pnpm check
pnpm dev
```

See [docs/SETUP.md](docs/SETUP.md) for details.
