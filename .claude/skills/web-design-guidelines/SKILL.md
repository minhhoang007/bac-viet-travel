---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the rules in [guidelines.md](guidelines.md) (a pinned copy, see SOURCE.md; do not fetch them from the web)
2. Read the specified files (or ask the user for files/pattern)
3. Check against all rules in guidelines.md
4. Output findings in the terse `file:line` format it specifies

Project rules win on conflict: `components/ui` and the `ui-components` skill, AGENTS.md, and the axe checks in the
E2E tests. Report a guideline the project deliberately does differently as a note, not a finding.

If no files are specified, ask the user which files to review.
