# ADR-0009: Shared editorial workflow (module `content`)

- Status: **Accepted** (2026-10-05)

## Context
Projects move staff-edited content (tours, blog posts) from files into the database so marketing can edit it
without a developer (CMS plan, step S3). The owner wants every change reviewed before visitors see it. Each content
type needs the same things: drafts, review, scheduled publishing, history with restore, preview, and protection when
two people edit at once. Building that per type would duplicate it.

## Decision
1. Module **`content`** (profile app, requires `admin`, uses `email` and `jobs`). Table `content_items`: project
   `type`, `slug`, `draft` (working copy, JSON), `published` (live copy, JSON, null until first published),
   `published_slug`, `status` (draft / pending / approved / published), `hidden`, `publish_at`, `revision`,
   `review_note`. Table `content_versions`: snapshots on submit and publish (newest 50 per item).
2. **The project owns the shape.** It validates `data` with its own zod schema before saving; the module stores JSON
   and never interprets it. Content types are declared in `product/manifest.ts` as `contentTypes`
   (`label`, `adminPath`, `publicPath`, `onChange` for cache revalidation).
3. **Live and working copies are separate.** Editing a published item changes only the draft (status back to
   "draft"); visitors keep the live copy, at its live slug, until the change is approved. A slug cannot be another
   item's draft slug or live slug.
4. **Workflow:** editor saves and submits (admins emailed) → admin publishes now, schedules (`approved` +
   `publish_at`, published by the jobs tick), or sends back with a note (author emailed). Admins may publish their own
   drafts directly. Any edit cancels a pending review or schedule. Admins hide or show the live copy.
5. **Optimistic locking:** every change sends the `revision` it was based on; a stale one fails with `CONFLICT`.
6. **Preview:** `/api/content/preview?id=` (staff only) turns on Next.js Draft Mode and opens the public page;
   `readContent(type, slug)` returns the working copy only while Draft Mode is on *and* the viewer is still staff.
7. **Starter UI:** review queue `/admin/content`; `<WorkflowPanel>` (status, actions, history, restore) for project
   edit pages; admin actions are written to the audit log. Times are entered and shown in `appConfig.timeZone`.

## Consequences
- Scheduled publishing is as precise as the jobs tick: daily on Vercel Hobby, every 10 minutes on Pro.
- Content is JSON, so queries inside it (filter tours by region) happen in the project, after loading the live copies;
  fine for tens to hundreds of items. Larger catalogs would add indexed columns in project tables.
- Starter migration `content_items` / `content_versions` (tables exist even when the module is off).
