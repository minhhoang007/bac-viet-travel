# Security review — v1.0.0-rc.1

- Date: 2026-09-30
- Scope: whole repository at the V1.0 branch (profiles `site` and `app`, module `email`)
- Method: `security-review-starter` checklist + tests. No external penetration test.

## Fixed during review

| # | Severity | Finding | Fix | Evidence |
|---|---|---|---|---|
| 1 | Medium | Contact-form name went into the email subject unfiltered (control characters) | Strip `\p{Cc}\p{Cf}` from the subject | `core/contact/contact.test.ts` "strips control characters" |
| 2 | Medium | Production accepted `http://` site URL; Better Auth sets `Secure` cookies only for https | Env validation requires https in production (localhost excepted) | `bootstrap/env.test.ts` "requires https in production" |
| 3 | Medium | `BETTER_AUTH_SECRET` had no minimum length | Require ≥ 32 characters | `bootstrap/env.test.ts` "rejects a short auth secret" |
| 4 | Low | Honeypot log line recorded the client IP (personal data) | Log without IP | code review |
| 5 | Low (UX/security) | Expired/invalid magic link redirected to the home page silently | `errorCallbackURL` → login page with a message | `tests/integration/auth.int.test.ts` "works only once" |

## Checklist result

| # | Item | Status | Evidence / note |
|---|---|---|---|
| 1 | Input validation at boundaries | ok | zod in contact, auth actions, notes service, env |
| 2 | Object-level authorization (ownerId) | ok | notes service scoped by `ownerId`; IDOR integration test + two-user browser check |
| 3 | CSRF | ok | Server Actions: Next.js Origin/Host check. `/api/auth/*`: Better Auth `trustedOrigins`. `/api/account/export` is a read-only GET (no CORS) |
| 4 | Session cookies | ok | HttpOnly + SameSite=Lax tested; Secure via https (finding 2) |
| 5 | Account linking | ok (config) | trusted providers + `requireLocalEmailVerified`. **No automated test** (needs a Google OAuth mock) |
| 6 | Module gating | ok | email off → action 404, `/api/auth` 404 in profile site (E2E) |
| 7 | Secrets | ok | only `NEXT_PUBLIC_SITE_URL` is public; `.env*` ignored; builds need no secrets |
| 8 | Safe errors | ok | `toSafeError`; provider errors wrapped |
| 9 | Webhooks | n/a | no webhooks until V1.1 |
| 10 | Rate limits | partial | contact form: app limiter; magic link: Better Auth limiter (**in-memory**, per instance) |
| 11 | Security headers | ok with accepted risk | CSP uses `'unsafe-inline'` for scripts (no nonces yet) |
| 12 | Uploads | n/a | storage module not built |
| 13 | SSRF / AI | n/a | no outbound user-controlled fetches |
| 14 | Dependencies | ok with note | 1 moderate: `esbuild ≤0.24.2` via `drizzle-kit` (dev server only, not in production runtime). CI fails on high |
| 15 | Audit log | n/a | admin module not built |
| 16 | Architecture lint | ok | 9 rules, each with a fixture |

## Accepted risks / follow-ups

1. **CSP `'unsafe-inline'` scripts.** Acceptable while pages load no third-party scripts. Move to nonces (`proxy.ts`) before adding analytics or user-generated HTML.
2. **Client IP from `x-forwarded-for`.** Correct on Vercel (the platform overwrites it). Behind another proxy, configure it to overwrite the header, or clients can rotate IPs to bypass the contact-form limit. See `docs/DEPLOY.md`.
3. **In-memory rate limits for magic links** (Better Auth). Fine for one instance; for several, configure Better Auth `rateLimit.storage` ("database" or secondary storage) in V1.1.
4. **Account linking untested automatically.** Add a mocked OAuth provider test when Google sign-in is used in a real project.
5. **Disabled users** can still complete a magic link, but every check treats them as signed out. Consider revoking their sessions when disabling (admin module, V1.2).
