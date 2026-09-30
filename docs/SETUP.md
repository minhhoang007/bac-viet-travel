# Setup

## 1. Máy phát triển

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | LTS hiện hành (khoá bằng `.nvmrc` / `engines`) | Windows: dùng `fnm` hoặc `nvm-windows` |
| pnpm | khoá bằng `packageManager` trong `package.json` | `corepack enable` |
| Git | ≥ 2.40 | `git config core.autocrlf input` trên Windows |
| Docker Desktop | mới nhất | Postgres local + integration test (profile app) |
| Claude Code / Codex / Cursor | tuỳ chọn | Xem mục 4 |

## 2. Khởi tạo project mới từ starter (sau khi có V1.0-rc)

```bash
git clone <starter-url> my-project
cd my-project
git remote rename origin starter
git remote add origin <project-url>
pnpm install
pnpm init:project        # tên, brand, profile, module; xoá _example-notes
cp .env.example .env.local
pnpm check
pnpm dev
```

`init:project` ghi `starter.lock.json` (phiên bản starter, ngày, profile, module bật).

## 3. Database (profile app)

```bash
docker compose up -d db
pnpm db:migrate          # starter trước, product sau (ADR-0004)
pnpm db:seed
```

## 4. Agent tooling (ADR-0003)

**Trong repo (nguồn sự thật, version theo starter):** `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`.

**Ở cấp user (không commit):**
- Tuỳ chọn ECC, **chỉ profile minimal, khoá phiên bản**: `npx ecc-universal@<pinned> setup --profile minimal`.
- Chỉ giữ: TDD, code-review, security-review, planner, rules common + TypeScript.
- **Tắt** continuous-learning / memory vault (lỗi đã biết trên Windows; luật tự sinh không qua review).
- Không bật MCP Supabase/Railway nếu không có trong ADR-0001.
- Đọc mã hook trước khi bật. Không cài chồng nhiều phương thức cài đặt.

**Kiểm tra:** mở agent trong repo, hỏi *"Which rules file wins if global rules conflict?"* → phải trả lời AGENTS.md.

## 5. Biến môi trường

`.env.example` được sinh theo profile/module. Nguyên tắc:
- Development, Preview, Production dùng secret riêng.
- Module tắt không cần biến của nó.
- Thiếu biến bắt buộc → lỗi rõ ràng ngay khi khởi động.

## 6. Lệnh chính (dự kiến)

| Lệnh | Việc |
|---|---|
| `pnpm dev` | chạy local |
| `pnpm check` | lint + typecheck + arch lint + fixtures + unit test |
| `pnpm test:int` | integration (cần Postgres) |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate:starter` / `db:generate:product` | sinh migration |
| `pnpm db:migrate` | chạy migration |
| `pnpm init:project` | khởi tạo project |
