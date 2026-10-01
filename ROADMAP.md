# Roadmap

Mỗi phase: giao cho agent **một phase**, agent chạy `pnpm check` xanh, bạn review rồi mới sang phase sau.
Mỗi task có **tiêu chí kiểm chứng** (theo skill `karpathy-guidelines`: mục tiêu phải kiểm chứng được).

Trạng thái: ⬜ chưa làm · 🟨 đang làm · ✅ xong

---

## Phase 0 — Chốt thiết kế (không code) ✅

- [x] Viết bộ docs, ADR và skill cho agent.
- [x] ADR 0001, 0003, 0004 Accepted (2026-09-30). ADR-0002 để đến trước V1.1.
- [x] i18n: có — next-intl, `vi` (mặc định) + `en`.
- [x] `git init`; push lên GitHub private `minhhoang007/minh-starter` (2026-10-01); CODEOWNERS = `@minhhoang007`.

**Exit:** mọi ADR cần cho V0.x đã *Accepted*.

---

## V0.1a — Nền móng ✅

| # | Task | Kiểm chứng |
|---|---|---|
| 1 | Next.js App Router + TS strict + pnpm + Tailwind + shadcn/ui | `pnpm build` xanh |
| 2 | `config/*.defaults.ts` + override `config/*.ts`; next-intl (`vi` mặc định, `en`), nội dung `content/<locale>/` | Đổi brand chỉ bằng override; `/` và `/en` render đúng ngôn ngữ |
| 3 | `core/env` + `bootstrap/env.ts` (zod, theo profile/module) | Thiếu biến bắt buộc → lỗi rõ khi khởi động; site không đòi DB/auth |
| 4 | `core/errors` (`AppError`), `core/logger` (structured, request id) | Unit test |
| 5 | `core/seo`: `createMetadata`, robots, sitemap | Unit test + snapshot metadata |
| 6 | Marketing blocks + layout, đọc từ `content/` | Không có chuỗi hard-code trong component (lint/grep) |
| 7 | `core/module`: `defineModule`, `assertModuleEnabled`; `bootstrap/container.ts` khung | Unit test |
| 8 | dependency-cruiser: core-no-upward, providers-only-from-bootstrap, no-circular + 3 fixture | Test fixture bắt đúng 3 rule |
| 9 | `pnpm check` + CI (GitHub Actions), job build "không secret" | CI xanh trên clean clone |
| 10 | Security headers cơ bản (CSP, HSTS…) | Test header |

**Exit:** site tĩnh chạy được, `pnpm check` xanh, CI build không cần secret nào.

## V0.1b — Email + form liên hệ ✅

| # | Task | Kiểm chứng |
|---|---|---|
| 1 | Module `email` (gửi trực tiếp) + `providers/email/resend` + `MailPort` | Unit test với fake provider |
| 2 | Rate limit: Upstash nếu có env, fallback in-memory | Test cả hai nhánh |
| 3 | Form liên hệ: validate → rate limit → email | Integration + E2E |
| 4 | Test "module off" đầu tiên (email tắt: không secret, build OK, endpoint 404) | Test tự động |
| 5 | Mở rộng lint: modules-public-api-only, vendor-sdk rule + fixture | Fixture test |
| 6 | `AGENTS.md` bản cập nhật theo code thật | Review |

**Exit:** dựng được website dịch vụ thật với cấu hình tối thiểu.

---

## V0.2 — Profile app + vertical slice ✅ (task 10 deploy còn chờ tài khoản Vercel/Neon/Resend)

| # | Task | Kiểm chứng |
|---|---|---|
| 1 | Postgres + Drizzle, hai config migration (ADR-0004), Postgres trong CI | Migrate DB trống xanh |
| 2 | Better Auth (Google + magic link) trong `core/auth/adapters/`, chính sách linking | Integration test linking |
| 3 | Startup check: `app` + magic link ⇒ `email` bật | Test fail-fast |
| 4 | Users, role user/admin, `auth.requireUser/requireRole` | Test |
| 5 | Protected routes; middleware chỉ đọc cookie | E2E |
| 6 | Account: xoá tài khoản (cascade), export JSON | Integration |
| 7 | Dashboard shell, trang Legal (template) | E2E smoke |
| 8 | `product/_example-notes/`: CRUD notes theo `ownerId` | **Test IDOR**: A không đọc/sửa/xoá được của B |
| 9 | Lint `no-db-in-ui-and-routes` + fixture | Fixture test |
| 10 | Deploy preview thật | Vertical slice chạy trên môi trường thật |

**Exit:** đăng nhập → CRUD bản ghi của mình → chặn người khác → deploy.

---

## V1.0 — Release 🟨 (`v1.0.0-rc.9`; deploy thật ✅ 2026-10-01; chờ project app thật của chủ repo)

> Quyết định 2026-09-30: project B (app) là **project thật** của chủ repo, không dựng project thử nghiệm.
> V1.0 được tag khi project đó chạy thật và phát hiện đã được ghi vào [docs/REUSE-PROOFS.md](docs/REUSE-PROOFS.md).

- [x] `pnpm init:project` (đổi tên/brand, chọn profile, bật module, xoá `_example-notes`) + `pnpm verify:init` (4 biến thể trên clone sạch).
- [x] Security review → [docs/security/review-v1.0.md](docs/security/review-v1.0.md) (5 lỗi đã sửa, 5 rủi ro chấp nhận có ghi lại).
- [x] Docs đầy đủ (README, ARCHITECTURE, AGENTS, SECURITY, UPGRADING, DEPLOY, REUSE-PROOFS).
- [ ] **36.B-1:** hai project thật (một site, một app); ghi mọi chỗ phải sửa Core/Modules. — 🟨 Site Hạ Long Tours (thử nghiệm) xong (F1–F7 → rc.2); project app = project thật của chủ repo.
- [x] **36.B-2:** nâng cấp một project từ tag cũ lên tag mới theo [docs/UPGRADING.md](docs/UPGRADING.md). — Hạ Long Tours rc.1 → rc.2; xung đột chỉ ở file project sở hữu; follow-up U1–U4; bước migration chưa được thử.
- [x] **36.B-3:** cấu hình tối thiểu (mọi module tắt, không secret) build + chạy — CI `build-minimal` + E2E.

> V1.0 phụ thuộc vào hai project thật. Trong lúc chờ, phát hành `v1.0.0-rc.N` để dùng.

**Exit:** tag `v1.0.0`.

---

## V1.1 — SaaS ✅ (chờ review; không có module usage theo quyết định 2026-09-30)

- [x] ADR-0002 (Vercel: `after()` + cron hằng ngày) và ADR-0005 (Polar quốc tế + VNPay Việt Nam, quyền có thời hạn).
- [x] `jobs`: claim nguyên tử, lease, retry backoff, dead, dedupe, dọn job cũ; `/api/jobs/run` + Vercel Cron.
- [x] `entitlements`: grant có thời hạn, cộng dồn kỳ, `can/getLimit` kiểm tra kiểu.
- [x] `billing`: Polar (checkout, portal, webhook state machine, sweeper, reconcile), VNPay (URL ký HMAC-SHA512, IPN, trang trả về).
- [x] Email: gửi trực tiếp, lỗi thì xếp job retry.
- [x] Xoá tài khoản huỷ subscription Polar trước; export có dữ liệu thanh toán; bản ghi tài chính được ẩn danh.
- [ ] Thanh toán thật trên sandbox Polar + VNPay (cần tài khoản của chủ repo).
- [ ] `usage` (giới hạn sử dụng): hoãn theo quyết định.

<details><summary>Kế hoạch gốc</summary>


Thứ tự: ADR-0002 (hosting/scheduler) → `jobs` → plans → `entitlements` → `billing` + webhook state machine → `usage` → email qua jobs.
Thêm `check-module-deps.ts` và fixture đầy đủ ở phase này (khi đã có nhiều module thật).
Mỗi module chỉ được gắn nhãn **Stable** khi đạt Module DoD ([REQUIREMENTS.md](REQUIREMENTS.md) §4).
</details>

## V1.2 — Vận hành ✅ (chờ review)

- [x] ADR-0006 (admin, analytics tự lưu Postgres, lưu file trên Cloudflare R2).
- [x] `admin`: `/admin` 404 với người không phải admin; người dùng (tìm, khoá/mở, đổi vai trò), job lỗi (chạy lại), thanh toán (webhook lỗi, xử lý lại), nhật ký; mọi thao tác ghi `audit_logs`; `pnpm admin:grant`.
- [x] `analytics`: beacon theo trang, chỉ lưu path + host nguồn; không lưu IP/UA; đồng ý cookie mới có visitor hash theo ngày; trang thống kê trong admin; xoá sau 13 tháng.
- [x] `storage`: upload thẳng lên R2 bằng URL ký (kiểm loại, kích thước, hạn mức theo gói, khoá theo user), xác nhận sau upload, tải bằng URL hết hạn, xoá tài khoản xoá file trước.
- [x] Dev/CI: SeaweedFS (S3) trong docker compose.
- [ ] Chạy thật trên R2 (cần tài khoản Cloudflare của chủ repo).

## V1.x — Tuỳ chọn 🟨

### Blog ✅
- [x] ADR-0007: bài viết là file MDX trong `content/blog/<locale>/`, frontmatter kiểm tra bằng zod (sai → build lỗi).
- [x] Trang danh sách (phân trang), bài viết, tag; tất cả prerender tĩnh, slug lạ → 404.
- [x] SEO: metadata + OpenGraph article, JSON-LD BlogPosting, hreflang theo `translationKey`, sitemap, RSS mỗi ngôn ngữ.
- [x] Bài nháp chỉ hiện khi dev; link "Blog" trong header khi bật module; 2 bài mẫu (xoá khi `init:project` trừ `--keep-example`).

### UI kit ✅
- [x] shadcn/ui trong `components/ui/`, theme lấy từ `config/brand.ts`, icon `lucide-react`.
- [x] Menu mobile (G3), FAQ accordion, Hero có ảnh (G4), slot `ProductLayoutExtras` (G1), DatePicker tiếng Việt, Toaster.
- [x] Kiểm tra a11y bằng axe trong E2E; skill `ui-components`.

### Production hardening (rc.8) ✅
- [x] Trang lỗi đa ngôn ngữ + log lỗi server (`instrumentation.ts`), `/api/health`.
- [x] Email HTML tự sinh; ảnh chia sẻ `/api/og` theo tiêu đề trang.
- [x] `container.rateLimiter` (G2); Dependabot; nâng GitHub Actions.
- [x] README, security review rc.8, DoD có bằng chứng.

### Còn lại ⬜
`ai` (+ `usage`), CLI `create-minh-app`.

---

## Prompt mẫu giao phase cho agent

```text
Implement phase V0.1a from ROADMAP.md. Only that phase.
Follow AGENTS.md and the phase-execution skill.
First reply with: plan, files to create, how each task will be verified. Wait for my OK.
Finish only when `pnpm check` is green; report each ROADMAP task with its evidence.
```
