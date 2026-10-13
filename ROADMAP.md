# Roadmap

Mỗi phase: giao cho agent **một phase**, agent chạy `pnpm check` xanh, bạn review rồi mới sang phase sau.
Mỗi task có **tiêu chí kiểm chứng** (theo skill `karpathy-guidelines`: mục tiêu phải kiểm chứng được).

Trạng thái: ⬜ chưa làm · 🟨 đang làm · ✅ xong

**Tình trạng (2026-10-08):** `v1.21.0`. Phase 0 → V1.2 và các mục tuỳ chọn đã xong; dùng thật ở 2 dự án (Hạ Long Tours: site, Bắc Việt Travel: app, đang chạy production). Việc tiếp theo: **V2 — Vận hành SaaS thật** (cuối file), chờ duyệt.

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

## V1.0 — Release ✅ (`v1.0.0`, 2026-10-05)

> Quyết định 2026-09-30: project B (app) là **project thật** của chủ repo, không dựng project thử nghiệm.
> V1.0 được tag khi project đó chạy thật và phát hiện đã được ghi vào [docs/REUSE-PROOFS.md](docs/REUSE-PROOFS.md).

- [x] `pnpm init:project` (đổi tên/brand, chọn profile, bật module, xoá `_example-notes`) + `pnpm verify:init` (4 biến thể trên clone sạch).
- [x] Security review → [docs/security/review-v1.0.md](docs/security/review-v1.0.md) (5 lỗi đã sửa, 5 rủi ro chấp nhận có ghi lại).
- [x] Docs đầy đủ (README, ARCHITECTURE, AGENTS, SECURITY, UPGRADING, DEPLOY, REUSE-PROOFS).
- [x] **36.B-1:** hai project thật (một site, một app); ghi mọi chỗ phải sửa Core/Modules. — Site Hạ Long Tours (F1–F7 → rc.2); app Bắc Việt Travel (G7–G12 → rc.10–rc.16), deploy thật, thanh toán VNPay sandbox qua IPN (2026-10-05).
- [x] **36.B-2:** nâng cấp một project từ tag cũ lên tag mới theo [docs/UPGRADING.md](docs/UPGRADING.md). — Hạ Long Tours rc.1 → rc.2; xung đột chỉ ở file project sở hữu; follow-up U1–U4. Bước migration: quyết định 2026-10-05 chấp nhận CI (migrate DB trống + `verify:init`) thay cho chạy tay.
- [x] **36.B-3:** cấu hình tối thiểu (mọi module tắt, không secret) build + chạy — CI `build-minimal` + E2E.

> Hai project thật đã xong (Hạ Long Tours, Bắc Việt Travel). Bắc Việt nâng cấp rc.12 → rc.16 không xung đột ở file của starter.

**Exit:** tag `v1.0.0`.

---

## V1.1 — SaaS ✅ (chờ review; không có module usage theo quyết định 2026-09-30)

- [x] ADR-0002 (Vercel: `after()` + cron hằng ngày) và ADR-0005 (Polar quốc tế + VNPay Việt Nam, quyền có thời hạn).
- [x] `jobs`: claim nguyên tử, lease, retry backoff, dead, dedupe, dọn job cũ; `/api/jobs/run` + Vercel Cron.
- [x] `entitlements`: grant có thời hạn, cộng dồn kỳ, `can/getLimit` kiểm tra kiểu.
- [x] `billing`: Polar (checkout, portal, webhook state machine, sweeper, reconcile), VNPay (URL ký HMAC-SHA512, IPN, trang trả về).
- [x] Email: gửi trực tiếp, lỗi thì xếp job retry.
- [x] Xoá tài khoản huỷ subscription Polar trước; export có dữ liệu thanh toán; bản ghi tài chính được ẩn danh.
- [x] VNPay sandbox chạy thật qua Bắc Việt Travel (IPN, querydr, 2026-10-05).
- [ ] Polar sandbox chạy thật (cần tài khoản của chủ repo).
- [ ] `usage` (giới hạn sử dụng): hoãn theo quyết định → V2 #6.

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

### rc.10 — Product context + payments ✅
- [x] `createProduct(db, ctx)`: logger, mail, rate limiter, payments, jobs, clock (G7).
- [x] Product đăng ký job handler / việc định kỳ (G7).
- [x] `container.payments.vnpay` không cần module billing, có cờ sandbox (G8).

### rc.11 — Admin cho product ✅
- [x] `productAdminNav`: trang admin của dự án có trong menu /admin (G9).
- [x] `ctx.audit`: thao tác admin của dự án ghi chung nhật ký audit (G9).

### rc.13 — Dashboard kit: shell, page, feedback, form ✅ (chờ review)
> Quyết định 2026-10-02: lấy pattern UI từ shadcn-admin, **không fork, không đổi cấu trúc thư mục**, không thêm
> TanStack Query/Zustand/RHF. Form mặc định = server action + `useActionState` + zod.

| # | Task | Kiểm chứng |
|---|---|---|
| ✅ 1 | `components/app-shell/`: `AppShell` (shadcn `sidebar`: thu gọn, nhớ trạng thái bằng cookie, Sheet trên mobile, skip-to-content), nav nhận từ props. Dashboard + admin dùng chung; xoá `components/dashboard/shell.tsx` | E2E 390px + desktop, axe sạch; `pnpm arch` xanh |
| ✅ 2 | `PageHeader` (title, description, actions, breadcrumb) dùng ở các trang dashboard/admin | Trang có đúng một `h1`; E2E |
| ✅ 3 | `components/feedback/`: `EmptyState`, `ErrorState`, `ConfirmDialog` | E2E admin khoá user qua dialog (repo chưa có môi trường test component) |
| ✅ 4 | `components/forms/`: `FormState<F>` + `toFormState`, `FormField`, `FormError`, `SubmitButton`; chuyển contact, login, note form | Test map lỗi zod/AppError; không còn `inputClass` lặp; E2E form cũ xanh |
| ✅ 5 | Luật: phân vai component, "xem cái có sẵn trước", quy ước state, quy ước form → AGENTS.md + skill `ui-components` | Review docs |

### rc.14 — Ship fast (học trải nghiệm ShipFast) ✅ (chờ review)
> Quyết định 2026-10-02: lấy trải nghiệm "lên mạng nhanh" của ShipFast, giữ kiến trúc + test. Làm trước DataTable.

| # | Task | Kiểm chứng |
|---|---|---|
| ✅ 1 | `docs/QUICKSTART.md`: clone → deploy → check trên một trang; README trỏ vào | Clean clone đo thời gian phần local |
| ✅ 2 | `pnpm setup:check`: Node, env thiếu theo profile/module (dùng chung luật `envProblems` với runtime), DB | Unit test; chạy thật với cấu hình sai → exit 1 |
| ✅ 3 | Block landing: `Pricing` (content-driven, dùng lại ở /pricing), `Steps`, `ProblemSolution`, `Testimonials`, `LogoCloud` | Render test; E2E trang chủ + axe + 390px |
| ✅ 4 | `pnpm launch:check <url>` | Unit test (fetch giả); chạy thật trên bac-viet-travel.vercel.app: 12/12 ✔ |
| ✅ 5 | `docs/LAUNCH.md`: domain, DNS email (SPF/DKIM/DMARC), thanh toán, prompt soạn điều khoản, vận hành | Review |

### rc.15 — Sửa sau security review + code review ✅ (2026-10-05)
| # | Task | Kiểm chứng |
|---|---|---|
| ✅ 1 | IPN VNPay dùng chung: kiểm chữ ký một lần → `vnpayIpn` của product → billing; chạy cả khi tắt billing (G8b) | Integration: 00/01/04/97/99, thứ tự product → billing, 404 khi không có VNPay |
| ✅ 2 | Rate limit checkout/portal/VNPay (10 / 10 phút / user) + dọn đơn VNPay pending > 24h | Integration |
| ✅ 3 | `/pricing` gói miễn phí hiện "0 ₫"; `launch:check` chỉ báo robots khi `User-agent: *` chặn `/` | Unit test |

### rc.16 — Favicon + đối soát VNPay (phát hiện từ Bắc Việt) ✅ (2026-10-05)
| # | Task | Kiểm chứng |
|---|---|---|
| ✅ 1 | G12: `/favicon.ico` và đường dẫn có dấu chấm → 404 (không còn 500); favicon từ brand (`app/icon.tsx`); `launch:check` kiểm favicon | E2E starter; unit test |
| ✅ 2 | G11: `query()` (querydr) trên adapter VNPay; `billing.reconcile_vnpay` xác nhận đơn đã trả mà mất IPN | Unit test (VNPay giả có ký); integration; chữ ký querydr kiểm chứng với sandbox thật |

### Sau v1.0 — phát hành theo nhu cầu dự án thật ✅ (v1.1.0 → v1.21.0, 2026-10-05 → 10-08)
Chi tiết từng bản: [CHANGELOG.md](CHANGELOG.md). Mỗi bản sinh ra từ một nhu cầu của Bắc Việt Travel, có test và được dự án nâng cấp ngay.

| Bản | Nội dung |
|---|---|
| v1.1 – v1.7 | CMS có quy trình duyệt (ADR-0009), thư viện ảnh Cloudinary (ADR-0008), vai trò `editor`; `ProductHeader`/`ProductFooter`/`productFontVariables`; xem trước bản nháp (Draft Mode), đổi slug → 308, tab SEO; blog viết trong admin; Markdown an toàn cho nội dung lưu DB (v1.5.2 security) |
| v1.8 – v1.12 | VietQR chuyển khoản; guardrail chống phình code (max-lines, knip, dup); bộ cấu hình agent; số liệu dự án trên trang admin; Vercel chỉ build production |
| v1.13 – v1.16 | Brand chỉ tối/chỉ sáng, bo góc; CSS riêng của dự án + style blog; menu admin theo quyền từng người; **theme đổi lúc chạy** (`productTheme`) |
| v1.17 – v1.18 | **Xác thực 2 lớp cho nhân viên** (passkey, app OTP, mã dự phòng), phiên nhân viên 12 giờ, xác thực lại trước thao tác nhạy cảm, đăng nhập bằng mã 6 số qua email, nhật ký bảo mật; dashboard dự án trên `/admin` (`ProductAdminOverview`); Next.js 16.4 |
| v1.19 – v1.20 | Chuyển trang tại chỗ (`next/link`, `ButtonLink`), hiệu ứng chuyển trang (`PageTransition`, `PageLink`) |
| v1.21 | Code review starter: khoá dòng khi kiểm mã đăng nhập; ảnh chia sẻ `/api/og` chỉ vẽ tiêu đề có chữ ký |

### rc.17 — DataTable kit ⬜ (làm khi một project cần bảng quản lý)
| # | Task | Kiểm chứng |
|---|---|---|
| 1 | `components/data-table/`: bảng server-side, trạng thái (trang, sắp xếp, lọc, tìm) nằm trên `searchParams`; khai báo cột có kiểu | Unit test parse/serialize URL state |
| 2 | Chuyển 4 bảng admin (users, audit, billing, jobs) sang kit | E2E phân trang/tìm kiếm; axe |
| 3 | Mẫu dùng trong `_example-notes` + skill `product-feature` | Review docs |

### V2 — Vận hành SaaS thật ⬜ (đề xuất 2026-10-08, chờ duyệt)
Đánh giá: starter đã đủ để chạy một **site bán hàng / đặt chỗ** (Bắc Việt đang chạy). Để chạy một **SaaS thu phí định kỳ** còn thiếu các mục dưới. Thứ tự = mức cần thiết.

**P1 — trước khi thu tiền khách SaaS**
| # | Task | Vì sao |
|---|---|---|
| 1 | Email vòng đời gói: biên nhận VNPay; nhắc gia hạn 7/3/1 ngày trước khi hết hạn (VNPay gia hạn tay); báo hết hạn / mất quyền; email chào mừng | Hiện billing không gửi email nào: khách VNPay quên gia hạn là mất |
| 2 | `setup:check` và `launch:check` cảnh báo: production chưa có Upstash (rate limit theo từng instance), `EMAIL_FROM` còn `resend.dev`, nội dung pháp lý còn mẫu | Hai lỗi vận hành thật đã gặp ở Bắc Việt |
| 3 | Theo dõi lỗi: adapter Sentry (hoặc tương đương) tuỳ chọn trong `instrumentation.ts` + lỗi client, cảnh báo qua email | Hiện lỗi chỉ nằm trong log Vercel, không ai được báo |
| 4 | Job định kỳ nhiều hơn 1 lần/ngày trên Vercel Hobby: mẫu GitHub Actions gọi `/api/jobs/run` (như Bắc Việt) | Đối soát thanh toán, nhắc gia hạn cần chạy theo giờ |

**P2 — đa số SaaS cần sớm**
| # | Task | Vì sao |
|---|---|---|
| 5 | Tổ chức / workspace: thành viên, lời mời qua email, vai trò trong workspace, gói tính theo workspace | SaaS B2B bán cho công ty, không cho từng người |
| 6 | `usage`: đo và giới hạn mức dùng theo gói (đã hoãn) | Gói theo số lượng (dự án, lượt, dung lượng) |
| 7 | Hỗ trợ khách: admin "xem như người dùng" (impersonate, có audit), ghi chú nội bộ | Giải quyết ticket nhanh |
| 8 | Feature flag đơn giản (bật theo user/workspace/phần trăm) | Ra mắt dần, thử nghiệm |
| 9 | Hoá đơn điện tử VAT (VNPT / Viettel / MISA) qua port, provider do dự án chọn | Doanh nghiệp Việt Nam cần hoá đơn |

**P3 — khi sản phẩm cần**
DataTable kit (rc.17), API key + webhook gửi đi cho khách, onboarding trong app, trang changelog / status, `ai`, CLI `create-minh-app`, command menu ⌘K.

### Còn lại ⬜
Xem V2 ở trên. Chạy thật còn chờ tài khoản chủ repo: sandbox Polar, Cloudflare R2, Cloudinary.

---

## Prompt mẫu giao phase cho agent

```text
Implement phase V0.1a from ROADMAP.md. Only that phase.
Follow AGENTS.md and the phase-execution skill.
First reply with: plan, files to create, how each task will be verified. Wait for my OK.
Finish only when `pnpm check` is green; report each ROADMAP task with its evidence.
```
