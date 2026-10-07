# Security

## Reporting
Report vulnerabilities privately to the maintainer (hoangvanminh007@gmail.com). Do not open public issues for security bugs.

## Baseline (every project built from the starter)

| Area | Requirement |
|---|---|
| Input | Schema validation (zod) at every boundary: routes, actions, webhooks, forms, env |
| Output | Escape/sanitize user content; never render raw HTML from users |
| AuthN | Session cookie `HttpOnly`, `Secure`, `SameSite=Lax`; no passwords: Google OAuth, magic link (behind a confirmation page so mail scanners cannot use it up, plus a 6-digit code for another device; optional Turnstile) and passkeys |
| Staff 2FA | Editors and admins need a second factor for the admin area (NIST 800-63B AAL2): a passkey with user verification, or TOTP + single-use backup codes; checked per session. Staff sessions end after 12 h; money, roles and security changes need a second factor within 10 minutes (step-up). Adding or removing a factor needs a fresh one; new staff devices and factor changes are emailed and logged (`auth_events`). Policy: `config/auth.ts` `staff` |
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
