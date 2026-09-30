#!/usr/bin/env bash
# Browser E2E for profile "app": clone the current commit, init an app project (keeping the example slice),
# migrate the E2E database, then run Playwright against `next dev`.
# Usage: pnpm test:e2e:app   (needs Postgres: docker compose db locally, or E2E_DATABASE_URL in CI)
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export E2E_DATABASE_URL="${E2E_DATABASE_URL:-postgres://postgres:postgres@localhost:54329/minh_test}"

git clone -q "$ROOT" "$WORK/app"
cd "$WORK/app"
pnpm install --frozen-lockfile --silent
node scripts/init-project.ts --name "E2E App" --profile app --keep-example >/dev/null
DATABASE_URL="$E2E_DATABASE_URL" node scripts/db-migrate.ts
pnpm exec playwright test -c playwright.app.config.ts "$@"
