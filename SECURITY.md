# Security

## Reporting
Report vulnerabilities privately to the maintainer (hoangvanminh007@gmail.com). Do not open public issues for security bugs.

## Baseline (every project built from the starter)

| Area | Requirement |
|---|---|
| Input | Schema validation (zod) at every boundary: routes, actions, webhooks, forms, env |
| Output | Escape/sanitize user content; never render raw HTML from users |
| AuthN | Session cookie `HttpOnly`, `Secure`, `SameSite=Lax`; Google OAuth + magic link only in V1 |
| AuthZ | Role-level (`user`/`admin`) + object-level (`ownerId` on every user query — anti-IDOR) |
| CSRF | Origin check on every mutation. Server Actions: Next.js compares Origin with Host automatically; custom route handlers must check explicitly |
| Account linking | Only verified email + trusted provider (`config/providers.ts`) |
| Rate limiting | Auth endpoints, contact form, expensive APIs; Redis in prod, in-memory fallback for `site` |
| Headers | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors |
| Webhooks | Signature on raw body, idempotent storage, async processing |
| Uploads | Real MIME check, size limit, owner, quota |
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
Use the `security-review-starter` skill before each release tag.
