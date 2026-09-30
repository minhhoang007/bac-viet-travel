# Roadmap

Mỗi phase: giao cho agent **một phase**, agent chạy `pnpm check` xanh, bạn review rồi mới sang phase sau.
Mỗi task có **tiêu chí kiểm chứng** (theo skill `karpathy-guidelines`: mục tiêu phải kiểm chứng được).

Trạng thái: ⬜ chưa làm · 🟨 đang làm · ✅ xong

---

## Phase 0 — Chốt thiết kế (không code) 🟨

- [x] Viết bộ docs, ADR và skill cho agent.
- [x] ADR 0001, 0003, 0004 Accepted (2026-09-30). ADR-0002 để đến trước V1.1.
- [x] i18n: có — next-intl, `vi` (mặc định) + `en`.
- [ ] `git init`, push repo starter, bật branch protection + CODEOWNERS.

**Exit:** mọi ADR cần cho V0.x đã *Accepted*.

---

## V0.1a — Nền móng ⬜

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

## V0.1b — Email + form liên hệ ⬜

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

## V0.2 — Profile app + vertical slice ⬜

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

## V1.0 — Release ⬜

- [ ] `pnpm init:project` (đổi tên/brand, chọn profile, tắt module, xoá `_example-notes`).
- [ ] Security review theo skill `security-review-starter` + [SECURITY.md](SECURITY.md).
- [ ] Docs đầy đủ (README, ARCHITECTURE, AGENTS, SECURITY, UPGRADING).
- [ ] **36.B-1:** hai project thật (một site, một app); ghi mọi chỗ phải sửa Core/Modules.
- [ ] **36.B-2:** nâng cấp một project từ tag cũ lên tag mới theo [docs/UPGRADING.md](docs/UPGRADING.md).
- [ ] **36.B-3:** cấu hình tối thiểu (mọi module tắt, không secret) build + chạy.

> V1.0 phụ thuộc vào hai project thật. Trong lúc chờ, phát hành `v1.0.0-rc.N` để dùng.

**Exit:** tag `v1.0.0`.

---

## V1.1 — SaaS ⬜

Thứ tự: ADR-0002 (hosting/scheduler) → `jobs` → plans → `entitlements` → `billing` + webhook state machine → `usage` → email qua jobs.
Thêm `check-module-deps.ts` và fixture đầy đủ ở phase này (khi đã có nhiều module thật).
Mỗi module chỉ được gắn nhãn **Stable** khi đạt Module DoD ([REQUIREMENTS.md](REQUIREMENTS.md) §4).

## V1.2 — Vận hành ⬜
`admin` (audit log), `analytics` (consent), `storage`.

## V1.x — Tuỳ chọn ⬜
`ai`, `blog`, CLI `create-minh-app`.

---

## Prompt mẫu giao phase cho agent

```text
Implement phase V0.1a from ROADMAP.md. Only that phase.
Follow AGENTS.md and the phase-execution skill.
First reply with: plan, files to create, how each task will be verified. Wait for my OK.
Finish only when `pnpm check` is green; report each ROADMAP task with its evidence.
```
