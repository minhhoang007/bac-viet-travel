# ADR-0008: Public media library on Cloudinary

- Status: **Accepted** (2026-10-05)

## Context
Projects need public images edited by non-developers: tour photos, blog covers, team pictures (CMS plan, project B).
The `storage` module (ADR-0006) is built for **private user files**: per-owner quota, short-lived signed download
URLs. Public images need the opposite: stable public URLs, CDN, resizing and modern formats, alt text, a focal point.
The owner chose Cloudinary's free plan (25 monthly credits: storage, bandwidth and transformations share them).

## Decision
1. New module **`media`** (profile app, requires `admin`): table `media_assets` (provider id, width, height, format,
   bytes, alt text per locale, focal point 0–1, status pending/ready, uploaded by). Staff only: editors and admins.
2. Port `MediaProvider` (`modules/media/ports.ts`), adapter `providers/media/cloudinary.ts` over Cloudinary's REST API
   (no SDK): signed upload parameters, resource lookup, destroy, delivery URL builder.
3. **Upload flow:** the server creates a pending row and returns signed upload fields (public id = `<folder>/<random uuid>`,
   `allowed_formats` signed so Cloudinary rejects other types). The browser uploads straight to Cloudinary. On confirm
   the server fetches the resource from Cloudinary's Admin API and checks format and size itself; anything else is
   destroyed. Pending rows older than an hour are purged with their image.
4. **Delivery:** `media.imageProps(asset, { aspect, widths })` returns `src`, `srcSet`, `width`, `height` built from
   Cloudinary transformations (`f_auto,q_auto`, width steps, `c_fill` with the focal point as gravity). Pages render a
   plain `<img>`: no Vercel image-optimization quota is used.
5. **Deletion** is blocked while a project reports the image in use (manifest `mediaInUse(id)`), so a live tour never
   loses its photo.
6. CSP: when the module is on, `connect-src` allows `https://api.cloudinary.com` and `img-src` allows
   `https://res.cloudinary.com`.

## Consequences
- Free plan limits apply (25 credits/month ≈ e.g. 10 GB storage + 15 GB bandwidth). Swapping to another provider
  means a new adapter; rows keep provider ids, so existing images must be migrated by script.
- First starter migration since rc.10: projects run `pnpm db:migrate` when upgrading.
