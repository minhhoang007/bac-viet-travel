# ADR-0006: Admin, first-party analytics, R2 storage

- Status: **Accepted** (2026-10-01)

## Context
V1.2 adds operations features: an admin area, usage statistics and file uploads. Requirements (REQUIREMENTS.md §4):
admin pages only for enabled modules and actions audit-logged; analytics respecting consent; uploads with MIME, size,
owner and quota checks and expiring signed URLs. The owner chose Cloudflare R2 for files and Postgres for analytics.

## Decision
1. **Admin** (`modules/admin`, profile app): `/admin/*` returns 404 to everyone who is not an admin (signed out included),
   so the area does not reveal itself. Pages: overview (stats), users (search, detail, disable/enable, role), jobs
   (failed/dead, retry), billing (subscriptions, orders, failed webhooks, reprocess), audit log.
   - Every state change writes `audit_logs` (actor id + email copy, action, target, metadata). User changes are written
     in the same transaction; module actions go through `admin.audited()`, which records only when something changed.
   - Disabling a user deletes their sessions. Admins cannot disable or demote themselves (no lock-out).
   - The first admin is made from the CLI: `pnpm admin:grant <email>` (also audited, actor "cli").
2. **Analytics** (`modules/analytics`, profiles site and app): events in our own Postgres (`analytics_events`), no
   third-party script or cookie.
   - The browser sends a beacon per navigation; the server keeps the **path only** (query string and fragment dropped:
     they can carry tokens) and the external referrer **host**. Raw IP and user agent are never stored. Known bots dropped.
   - **Consent** (first-party cookie `analytics_consent`): without it an event is an anonymous count; with it the event
     gets a daily-rotating visitor hash (HMAC of the day with `ANALYTICS_SECRET`, then SHA-256 with IP + user agent)
     and the signed-in user id. Unique visitors are therefore counted only for consenting visitors.
   - Retention 13 months (periodic purge when jobs is on). Events are included in the account export; deleting the
     account unlinks them.
   - Signups and Pro users come from their source tables (users, access grants), not from events.
   - Profile site needs `DATABASE_URL` just for events; the stats page lives in admin (profile app).
3. **Storage** (`modules/storage`, profile app): S3 API, Cloudflare R2 in production, SeaweedFS locally and in CI
   (MinIO images are no longer published on Docker Hub).
   - **Direct upload**: the server validates type (allowlist), size and quota, reserves the space (pending row under a
     per-user advisory lock, so parallel uploads cannot overshoot), and returns a presigned PUT whose signature covers
     content type and length. After the upload the server checks the stored object (HEAD) matches, then marks it ready;
     a mismatch deletes it. Unconfirmed reservations are purged after an hour.
   - Downloads: owner check, then a 302 to a presigned GET (5 minutes) that forces `attachment` with the original name.
   - Object keys are `u/<userId>/<uuid>`; user file names never reach the key.
   - Quota = the `storage.max_bytes` entitlement (free plan value when entitlements is off).
   - Account deletion deletes the objects first; a storage failure aborts the deletion (no orphaned personal files).
   - CSP `connect-src` includes the storage origin (`STORAGE_ENDPOINT`, read at build time).

## Consequences
- The server never sees file bytes, so there is no content sniffing (magic-byte) check; mitigated by the type allowlist
  (no HTML/SVG/JS), the signed content type, and forced `attachment` downloads. Projects that render user images inline
  or need virus scanning add that themselves.
- Admin has two roles only (user/admin); fine-grained permissions are out of scope.
- Analytics is deliberately simple (no funnels, no session replay). Projects that need more can add a provider later.
