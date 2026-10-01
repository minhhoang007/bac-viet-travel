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
| 5 | Low (UX/security) | Expired/invalid magic link redirected to the home page silently | `errorCallbackURL` → login page with a message | `tests/integration/auth.int.test.ts` "works only once", `tests/e2e-app` |

## Fixed after external review (2026-09-30)

The first version of this report missed the findings below; an independent review reproduced them.

| # | Severity | Finding | Fix | Evidence |
|---|---|---|---|---|
| 6 | **High (P1)** | Magic-link requests from the Server Action called `auth.api.signInMagicLink()` directly, which **bypasses Better Auth's HTTP rate limiter**: unlimited emails to any address (8/8 direct calls succeeded; HTTP endpoint returned 429 from the 6th). The earlier "partial, in-memory" assessment was wrong | `AuthService.signInMagicLink` enforces two app limiters before calling Better Auth: per client (5/10 min) and per recipient (3/10 min) | `auth.int.test.ts` "rate limited per recipient…", "…per client…"; `tests/e2e-app` "rate limited in the UI" |
| 7 | Medium (P2) | Production logs contained the contact sender's name: the email module logged `subject` on success and failure | Mail messages carry a `kind`; the email module logs only `{ id, kind }` (and the error message on failure) | `modules/email/tests/email.test.ts`, `core/contact/contact.test.ts` "never logs…" |
| 8 | Medium (P2) | An Upstash failure threw out of the contact action (limiter call outside try/catch), so users got an error page instead of the prepared message | `withFallback(upstash, memory)` for every shared limiter (logs `ratelimit.store_failed`); contact service also catches limiter errors and returns `{ status: "error" }` without sending | `core/security/rate-limit.test.ts`, `core/contact/contact.test.ts` "limiter throws" |
| 9 | Medium (P2) | `config/brand.ts` colors had no effect (hard-coded in `globals.css`), forcing projects to edit a starter-owned file | Theme variables are generated from `brand.colors` (light/dark) by `components/ui/theme.ts` in the root layout; values are validated so config cannot inject CSS | `components/ui/theme.test.ts`, E2E "theme colors come from config" |

## V1.1 billing addendum (2026-09-30)

| Check | Status | Evidence |
|---|---|---|
| Webhook signature on raw body, replay window | ok | official Polar SDK; forged / tampered / stale timestamp rejected (`providers/billing/billing-providers.test.ts`) |
| Webhook idempotency, ordering, crash safety | ok | `tests/integration/billing.int.test.ts` |
| VNPay IPN: signature, TmnCode, amount, idempotency | ok | codes 97/01/04/02/00 tested; forged IPN in E2E |
| Access never granted from the browser return URL | ok | return page reads status only |
| Cron endpoint auth | ok | timing-safe Bearer check; 401 tests |
| Deleting an account cannot leave a paying subscription | ok | revoke-first hook; deletion aborts if the provider fails |
| Personal data at rest in jobs | ok with note | queued emails live in `jobs.payload` until purged (7 days succeeded, 30 days dead) |
| Real-money flows | ⏳ | sandbox purchase per provider required before go-live (DEPLOY.md) |

## V1.2 ops addendum (2026-10-01)

| Check | Status | Evidence |
|---|---|---|
| Admin area hidden and guarded server-side | ok | `requireAdmin()` on every page/action → 404; E2E: signed out / non-admin get 404 |
| Admin actions audited, no self lock-out | ok | `tests/integration/admin.int.test.ts` |
| Disabled user loses access immediately | ok | sessions deleted + `getUser` rejects disabled; E2E |
| Analytics stores no IP / user agent / query strings | ok | `modules/analytics/tests/analytics.int.test.ts`; E2E strips `?token=` |
| Analytics consent | ok | no visitor hash or user id without the consent cookie (int + E2E) |
| Collect endpoint abuse | ok with note | origin check, 2 KB body limit, 60/min per IP (per instance) |
| Upload type / size / quota, parallel quota race | ok | advisory lock; 15 parallel requests → exactly 10 fit (`tests/integration/storage.int.test.ts`) |
| Upload signature covers type and length | ok | `providers/storage/s3.int.test.ts` (wrong type / longer body rejected) |
| Download IDOR, expiring URLs | ok | int + E2E (other user → 404; expired URL → 403) |
| Stored XSS via uploads | ok with note | no HTML/SVG/JS allowed, forced `attachment`; no magic-byte check (server never sees bytes) |
| Personal files on account deletion | ok | objects deleted first; storage failure aborts deletion |

## Re-review for rc.8 (2026-10-01)

Status changes since the V1.0 checklist below:

| Item | Now | Evidence |
|---|---|---|
| 9 Webhooks | ok | V1.1 addendum (signature, idempotency, ordering, crash safety) |
| 12 Uploads | ok with note | V1.2 addendum (type allowlist, signed type/size, quota race, IDOR, attachment downloads) |
| 15 Audit log | ok | V1.2 addendum (`audit_logs`, admin actions tested) |
| 14 Dependencies | ok with note | same single moderate advisory (esbuild dev server), now reached via `better-auth → drizzle-kit`; not used at runtime. Dependabot weekly |
| Accepted risk 5 (disabled users) | **resolved** | disabling deletes sessions; `getUser` rejects disabled users (admin int + E2E) |
| Accepted risk 1 (CSP `'unsafe-inline'`) | still accepted | re-checked: analytics is first-party (same origin), MDX is trusted repo content, shadcn/Radix load no external scripts. Move to nonces before any third-party script |
| New: `/api/health` | ok | returns only `status`, commit and `db` state; no config or error details; `no-store` |
| New: `/api/og` (share images) | ok with note | renders a length-limited title in brand colors; anyone can request an image with arbitrary text (no data exposure; CDN-cached) |
| New: error pages | ok | show a digest reference only; the server logs the error with path (no query string) via `instrumentation.ts` |
| New: HTML emails | ok | generated from text with full escaping; only http(s) URLs become links; accent color validated |

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
| 10 | Rate limits | ok | contact form and magic links: app limiters (Upstash with in-memory fallback). Better Auth's own limiter only covers direct HTTP calls to `/api/auth/*` |
| 11 | Security headers | ok with accepted risk | CSP uses `'unsafe-inline'` for scripts (no nonces yet) |
| 12 | Uploads | n/a | storage module not built |
| 13 | SSRF / AI | n/a | no outbound user-controlled fetches |
| 14 | Dependencies | ok with note | 1 moderate: `esbuild ≤0.24.2` via `drizzle-kit` (dev server only, not in production runtime). CI fails on high |
| 15 | Audit log | n/a | admin module not built |
| 16 | Architecture lint | ok | 9 rules, each with a fixture |

## Accepted risks / follow-ups

1. **CSP `'unsafe-inline'` scripts.** Acceptable while pages load no third-party scripts. Move to nonces (`proxy.ts`) before adding analytics or user-generated HTML.
2. **Client IP from `x-forwarded-for`.** Correct on Vercel (the platform overwrites it). Behind another proxy, configure it to overwrite the header, or clients can rotate IPs to bypass the contact-form limit. See `docs/DEPLOY.md`.
3. **Better Auth's built-in limiter is in-memory** and only guards direct HTTP calls to `/api/auth/*`. App flows are limited by the app limiters (finding 6). For several instances, also set Better Auth `rateLimit.storage` in V1.1.
4. **Google OAuth untested in the browser** (needs real or mocked credentials). **Account linking untested automatically.** Add a mocked OAuth provider test when Google sign-in is used in a real project.
5. **Disabled users** can still complete a magic link, but every check treats them as signed out. Consider revoking their sessions when disabling (admin module, V1.2).
