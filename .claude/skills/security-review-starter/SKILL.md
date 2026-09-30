---
name: security-review-starter
description: Security review checklist tailored to this starter's architecture. Use before release tags, on PRs touching auth/billing/webhooks/uploads/AI, or when asked for a security review.
---

# Security review (starter-specific)

Review the diff (or whole repo before a release) against each item. Report: item, status (ok / issue / n/a), evidence (file:line), fix.

## Checklist
1. **Boundaries:** every route/action validates input with zod; no raw `request.json()` used unvalidated.
2. **AuthZ:** every user-data query filters by session `ownerId`; admin routes use `requireRole("admin")`.
3. **CSRF:** mutations check Origin.
4. **Session cookies:** HttpOnly, Secure, SameSite=Lax.
5. **Account linking:** verified email + trusted provider only.
6. **Module gating:** optional module endpoints call `assertModuleEnabled`.
7. **Secrets:** no secrets in client bundles (`NEXT_PUBLIC_` audit), logs, errors, or committed files.
8. **Errors:** no raw DB/provider errors to clients.
9. **Webhooks:** raw-body signature verification; idempotent; async processing.
10. **Rate limits:** auth, contact form, expensive endpoints.
11. **Headers:** CSP (no `unsafe-inline` scripts without nonce), HSTS, frame-ancestors, nosniff.
12. **Uploads:** real MIME sniffing, size, owner, quota; signed URLs short-lived.
13. **SSRF / AI:** outbound fetch blocks private/metadata IPs; untrusted content cannot trigger sensitive actions; AI keys server-only.
14. **Dependencies:** `pnpm audit` clean or triaged.
15. **Audit log:** admin/sensitive actions recorded.
16. **Architecture:** `pnpm check` arch lint green — vendor SDKs and DB drivers only in allowed paths.

## Output
Findings ranked by severity (critical/high/medium/low), each with a concrete exploit scenario. No speculative findings without a path to exploitation.
