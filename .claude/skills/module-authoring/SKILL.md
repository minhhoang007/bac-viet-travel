---
name: module-authoring
description: Create or modify an optional starter module (email, jobs, billing, usage, storage, ...) so it follows the module contract and is "really off" when disabled. Use when touching modules/** or providers/**.
---

# Module authoring

## Files
```
modules/<name>/
  module.ts      defineModule({ name, profile, requires, uses, env, nav }) — no SDK imports
  index.ts       the ONLY public API
  ports.ts       interfaces this module needs (provider port, etc.)
  service.ts     create<Name>Module(deps) factory — lazy, no top-level env/SDK
  repository.ts  only for critical domains (users, subscriptions, entitlements, usage, jobs)
  schema.ts      Drizzle tables (starter migrations)
  tests/
providers/<area>/<vendor>.ts   vendor SDK adapter implementing the port
```
Wire in `bootstrap/container.ts`, `bootstrap/env.ts`, `bootstrap/navigation.ts`. Add the flag to `config/features.defaults.ts` (default off).

## Contract checklist
- [ ] `requires` / `uses` complete; `uses` targets checked for `enabled` at runtime.
- [ ] No import of another module's internals, `product/`, `providers/`, `bootstrap/`.
- [ ] No env read or SDK init at module scope.
- [ ] Every route/page/action calls `assertModuleEnabled("<name>")`.
- [ ] Job handlers and sweepers registered only when enabled.
- [ ] Errors are `AppError` codes; no raw vendor errors leak.
- [ ] Money as integers.

## "Really off" test (mandatory)
With the module disabled and its env vars absent:
1. env validation passes,
2. build succeeds,
3. its endpoints return 404,
4. its jobs are not registered, menu hidden.

## Before marking Stable
Meet the module's DoD in `REQUIREMENTS.md` §4. Use `tdd-critical-flows` for failure paths.
