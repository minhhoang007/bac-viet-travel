# ADR-0001: Default stack

- Status: **Accepted** (2026-09-30)
- Date: 2026-09-30

## Decision

| Area | Default | Alternative |
|---|---|---|
| Framework | Next.js App Router + TypeScript strict | — |
| UI | Tailwind CSS + shadcn/ui | — |
| Package manager | pnpm (pinned via `packageManager`) | — |
| Validation | zod | valibot |
| DB / ORM | PostgreSQL / Drizzle | Prisma |
| Auth | Better Auth (Google + magic link) | Auth.js, Supabase Auth |
| Email | Resend + React Email | Postmark |
| Rate limit | Upstash Redis; in-memory fallback for `site` | — |
| Storage | S3-compatible (R2/S3) | — |
| Analytics | PostHog | Plausible |
| Monitoring | Sentry | — |
| Tests | Vitest + Playwright; real Postgres in CI (service container / Testcontainers) | — |
| Arch lint | dependency-cruiser | eslint-plugin-boundaries |
| i18n | next-intl, locales `vi` (default) + `en`, from V0.1a; strings in `content/<locale>/` | — |
| Hosting | Vercel (see ADR-0002) | — |
| Billing | Chosen by market (ADR pending). For a Vietnam entity, prefer merchant-of-record (Polar, Lemon Squeezy, Paddle) | Stripe |

## Version pins (2026-09-30)
- TypeScript **6.x**: dependency-cruiser does not support TS 7 yet. Revisit when it does.
- ESLint **9.x**: eslint-plugin-react (via eslint-config-next) breaks on ESLint 10.
- Next.js 16 uses `proxy.ts` (formerly `middleware.ts`).
- next-intl: `localePrefix: "as-needed"`, `localeDetection: false` (no Accept-Language redirects; `/` is always `vi`).

## Consequences
- Verify current docs of Better Auth (account linking), Vercel limits and the billing provider at implementation time.
- Vendor SDKs isolated in `providers/` and `core/auth/adapters/` so swaps stay local.
