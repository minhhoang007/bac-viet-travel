# Deploy

Default target: **Vercel** (ADR-0001). Any Node host works; see "Other hosts".

## Profile `site`

1. Import the repository in Vercel (framework: Next.js; install `pnpm install --frozen-lockfile`).
2. Environment variables (Production and Preview separately — never share secrets):
   - `NEXT_PUBLIC_SITE_URL` = `https://your-domain` (https is required in production)
   - Email module on: `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` (a verified Resend domain), `CONTACT_TO_EMAIL`
   - Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (shared rate limit across instances)
3. Deploy. The build needs no secrets; missing runtime variables fail fast with a list of problems.

## Profile `app`

Everything above, plus:

1. **Postgres** (e.g. Neon, Supabase, RDS). Use the pooled connection string for `DATABASE_URL`.
2. `BETTER_AUTH_SECRET`: `openssl rand -base64 32` (≥ 32 chars; different per environment).
3. Optional Google sign-in: create an OAuth client, redirect URI `https://your-domain/api/auth/callback/google`, set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
4. **Migrations** run before the new version serves traffic:
   ```bash
   DATABASE_URL=<production url> pnpm db:migrate   # starter first, then product
   ```
   Run from CI or locally against production; always test on a copy first (docs/UPGRADING.md).
5. Preview deployments need their own database (or a Neon branch) — never point previews at production data.

## Billing (jobs + entitlements + billing modules)

1. **Cron:** `vercel.json` schedules `/api/jobs/run` daily. Set `CRON_SECRET` (Vercel sends it as a Bearer token).
   Need more frequent runs? Vercel Pro or QStash calling the same URL (ADR-0002).
2. **Polar:** create products (Pro monthly/yearly) → set `POLAR_PRODUCT_PRO_MONTHLY/YEARLY`; create an organization
   access token → `POLAR_ACCESS_TOKEN`; add a webhook endpoint `https://<domain>/api/billing/webhooks/polar`
   (subscription.* events) → `POLAR_WEBHOOK_SECRET`. `POLAR_SERVER=production` in production.
3. **VNPay:** `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`; register the IPN URL `https://<domain>/api/billing/vnpay/ipn`
   with VNPay; production `VNPAY_PAYMENT_URL=https://pay.vnpay.vn/vpcpay.html` (confirm with VNPay).
4. **Before going live:** one sandbox purchase per provider end to end (checkout → webhook/IPN → Pro shown on
   /dashboard/billing → Polar portal cancel → access until period end). Tests only simulate provider traffic.

## Admin, analytics, storage (V1.2)

1. **Admin:** after the first sign-in, run `DATABASE_URL=<prod url> pnpm admin:grant you@example.com`. The Admin link
   then appears in the dashboard; `/admin` is a 404 for everyone else.
2. **Analytics:** set `ANALYTICS_SECRET` (≥32 chars). Update the privacy page (content/legal.ts): first-party
   statistics, consent cookie `analytics_consent`, 13-month retention.
3. **Storage (Cloudflare R2):** create a bucket; create an R2 API token (Object Read & Write, that bucket only) →
   `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY`; `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
   `STORAGE_BUCKET`. Set `STORAGE_ENDPOINT` for **builds** too (CSP allows the browser to upload there).
   Add a CORS rule on the bucket:
   ```json
   [{ "AllowedOrigins": ["https://<your-domain>"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
   Keep the bucket private (no public access, no r2.dev URL): downloads use short-lived signed URLs.
4. **Before going live:** upload, download and delete one file on the deployed site; check `/admin` stats.

## Verify after deploy

- `/` and `/en` render; `/robots.txt`, `/sitemap.xml` list the real domain.
- Response headers include CSP and HSTS.
- Profile app: `/dashboard` → login → magic link email arrives → dashboard → create a note → a second account gets 404 on that note's URL → account export downloads → account delete signs out.

## Other hosts

- Put the app behind a proxy that **overwrites** `X-Forwarded-For` with the real client IP; otherwise rate limits can be bypassed.
- Run `pnpm build && pnpm start` with `NODE_ENV=production`.
- Several instances: set Upstash env vars for the contact-form limiter.
