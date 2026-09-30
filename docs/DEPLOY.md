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

## Verify after deploy

- `/` and `/en` render; `/robots.txt`, `/sitemap.xml` list the real domain.
- Response headers include CSP and HSTS.
- Profile app: `/dashboard` → login → magic link email arrives → dashboard → create a note → a second account gets 404 on that note's URL → account export downloads → account delete signs out.

## Other hosts

- Put the app behind a proxy that **overwrites** `X-Forwarded-For` with the real client IP; otherwise rate limits can be bypassed.
- Run `pnpm build && pnpm start` with `NODE_ENV=production`.
- Several instances: set Upstash env vars for the contact-form limiter.
