#!/usr/bin/env bash
# Reuse check: clone the current commit, run init:project for each profile, then check + build (+ integration for app).
# Usage: pnpm verify:init   (needs the docker compose db for the app profile integration tests)
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

run_case() {
  local label="$1"; shift
  local dir="$WORK/$label"
  echo "=== $label: init:project $* ==="
  git clone -q "$ROOT" "$dir"
  (
    cd "$dir"
    pnpm install --frozen-lockfile --silent
    node scripts/init-project.ts "$@" >/dev/null
    pnpm check >/dev/null
    pnpm build >/dev/null
    if grep -q '"profile": "app"' starter.lock.json; then pnpm test:int >/dev/null; fi
    echo "--- $label OK ($(git status --short | wc -l | tr -d ' ') files changed by init)"
  )
}

run_case site --name "Tour Hạ Long" --profile site
run_case site-email --name "Khách sạn Biển" --profile site --modules email
run_case app --name "My SaaS" --profile app
run_case app-keep-example --name "Demo" --profile app --keep-example
echo "All init cases passed."
