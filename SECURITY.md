# Security

## Reporting
Report vulnerabilities privately to the maintainer (hoangvanminh007@gmail.com). Do not open public issues for security bugs.

## Baseline (every project built from the starter)

| Area | Requirement |
|---|---|
| Input | Schema validation (zod) at every boundary: routes, actions, webhooks, forms, env |
| Output | Escape/sanitize user content; never render raw HTML from users |
| AuthN | Session cookie `HttpOnly`, `Secure`, `SameSite=Lax`; Google OAuth, magic link (behind a confirmation page so mail scanners cannot use it up, plus a 6-digit code for another device; optional Turnstile) and passkeys. Passwords are off by default (`methods.password`); when on, for staff only: no sign-up, set from an emailed one-time link (admin invitation 24 h, "forgot password" 4 h; active staff accounts only, no link stored for anyone else, same answer in the same time for any address (the lookup and the email run after the answer); a sent link replaces older unused ones, but a "forgot password" link never replaces an admin's invitation; setting, changing or resetting a password spends every older link), 12–128 characters checked against known breaches (Have I Been Pwned, k-anonymity; fails closed), hashed by Better Auth (scrypt), 10 attempts per 15 min per client and per address, one message (and the same answer time) for any wrong email or password; a customer account cannot sign in with one. Setting, changing or resetting one signs the account out elsewhere, is emailed and logged. The HTTP endpoints for passwords are closed: only the auth service (server actions) uses them |
| Staff 2FA | Editors and admins need a second factor for the admin area (NIST 800-63B AAL2): a passkey with user verification, or TOTP + single-use backup codes; checked per session. Staff sessions end after 12 h; money, roles and security changes need a second factor within 10 minutes (step-up). Adding or removing a factor, or changing the password, needs a fresh one; with a password and the authenticator app, the code is asked before any session exists, and authenticator-app changes ask for the password again; a staff account without a second factor cannot sign in with its password (the right one only says to sign in by email link first), so the first factor is set up from a session that proved the email address, never by whoever learned the password; new staff devices and factor changes are emailed and logged (`auth_events`). Removing a staff member disables the whole account (all sessions end, unused password links spent; also as a customer), and adding them again needs an admin to enable it first. Policy: `config/auth.ts` `staff` |
| AuthZ | Role-level (`user`/`admin`) + object-level (`ownerId` on every user query — anti-IDOR) |
| CSRF | Origin check on every mutation. Server Actions: Next.js compares Origin with Host automatically; custom route handlers must check explicitly |
| Account linking | Only verified email + trusted provider (`config/providers.ts`) |
| Rate limiting | Auth endpoints, contact form, expensive APIs; Redis in prod, in-memory fallback for `site` |
| Headers | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors |
| Webhooks | Signature on raw body, idempotent storage, async processing |
| Uploads | Type allowlist (no HTML/SVG/JS), signed content type + size, owner, quota, forced `attachment` downloads (ADR-0006) |
| Secrets | Per-environment, never shared between dev/preview/prod; rotation procedure documented |
| Logging | Structured, request id; never log secrets, tokens, personal data |
| Errors | Safe user messages; raw DB/provider errors never reach the client |
| Audit | Admin actions and sensitive changes logged |
| AI / URL fetch | Block SSRF (private IPs, metadata endpoints); treat user/web content as untrusted (prompt injection); AI keys server-only |
| Dependencies | `pnpm audit` in CI + Renovate/Dependabot |

## Agent tooling
- Third-party hooks/skills/plugins execute on developer machines. Read hook code before enabling it.
- Install agent tooling only from official sources, with pinned versions ([ADR-0003](docs/adr/0003-agent-tooling.md)).
- Agent-authored PRs touching protected paths require maintainer review (CODEOWNERS).

## Review checklist
Use the `security-review-starter` skill before each release tag. Reports and accepted risks: [docs/security/](docs/security/).
