# Quickstart — từ clone đến lên mạng

Một trang, làm từ trên xuống. Chi tiết từng phần: [SETUP.md](SETUP.md), [DEPLOY.md](DEPLOY.md), [LAUNCH.md](LAUNCH.md).

Cần có: Node ≥ 24, `corepack enable` (pnpm), Git. Profile `app` cần thêm Docker để chạy Postgres ở máy.

## 1. Tạo project (5 phút)

```bash
git clone <starter-url> my-project && cd my-project
git remote rename origin starter            # giữ lịch sử starter để nâng cấp sau này
pnpm install
pnpm init:project --name "My Project" --profile site --modules email,blog
#                                     hoặc --profile app --modules email,billing,admin
cp .env.example .env.local
```

Chọn profile:
- `site`: website dịch vụ, landing page, blog. Không cần database.
- `app`: có đăng nhập, dashboard, thanh toán. Cần Postgres.

## 2. Kiểm tra máy và cấu hình (1 phút)

```bash
pnpm setup:check
```

Lệnh này liệt kê **chính xác** biến môi trường còn thiếu cho profile và các module đã bật, kiểm tra phiên bản Node,
và với profile `app` thì thử kết nối database. Nó chỉ in tên biến, không bao giờ in giá trị.
Sửa đến khi mọi dòng là ✔.

Profile `app`, trước khi chạy lại `setup:check`:

```bash
pnpm db:up && pnpm db:migrate
```

## 3. Chạy và sửa nội dung (10 phút)

```bash
pnpm dev                                    # http://localhost:3000
```

Những chỗ sửa đầu tiên:

| Muốn đổi | Sửa ở |
|---|---|
| Tên, logo chữ, màu | `config/app.ts`, `config/brand.ts` |
| Chữ trên trang chủ (hero, tính năng, bảng giá, FAQ…) | `content/vi/marketing.ts`, `content/en/marketing.ts` |
| Bật/tắt khối trang chủ | Xoá hoặc thêm khóa `logos`, `problemSolution`, `steps`, `testimonials`, `pricing` trong content |
| Menu trên cùng | `config/navigation.ts` |
| Khối riêng của sản phẩm trên trang chủ | `product/home.tsx` |
| Điều khoản, chính sách riêng tư | `content/legal.ts`. Có prompt soạn thảo trong [LAUNCH.md](LAUNCH.md#4-điều-khoản-và-chính-sách-riêng-tư) |

Profile `app`: mở `/login`. Với `EMAIL_PROVIDER=console`, link đăng nhập được in trong log của server.
Feature mẫu nằm ở `product/_example-notes`. Hãy làm feature của bạn theo đúng mẫu đó (skill `product-feature`).

## 4. Deploy lên Vercel (10 phút)

1. Đẩy code lên GitHub, rồi import repo vào Vercel (framework Next.js).
2. Thêm biến môi trường cho Production (theo những gì `setup:check` yêu cầu):
   `NEXT_PUBLIC_SITE_URL=https://<domain>`, và với module email: `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL`.
3. Profile `app`: tạo database Neon, đặt `DATABASE_URL` (connection string có pooling) và `BETTER_AUTH_SECRET`
   (`openssl rand -base64 32`). Chạy migration lên database production:
   ```bash
   DATABASE_URL=<neon-url> pnpm db:migrate
   ```
4. Deploy. Biến nào còn thiếu thì app dừng ngay khi khởi động và in đúng danh sách biến đó.

## 5. Kiểm tra trước khi công bố (2 phút)

```bash
pnpm launch:check https://<domain>
```

Lệnh này kiểm tra HTTPS, title/description/canonical, ảnh chia sẻ, security headers, robots.txt, sitemap, `/api/health`,
trang điều khoản và trang riêng tư. Phần phải làm bằng tay (DNS email, thanh toán thật, sao lưu): [LAUNCH.md](LAUNCH.md).

## Khi gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| App không khởi động, báo `Invalid configuration` | `pnpm setup:check`, rồi thêm các biến nó liệt kê |
| `Database unreachable` | Ở máy: `pnpm db:up`. Trên Vercel: kiểm tra `DATABASE_URL` |
| Không nhận được email đăng nhập | Xem log server (`console`) hoặc cấu hình DNS cho Resend ([LAUNCH.md](LAUNCH.md#2-email-không-vào-spam)) |
| `pnpm check` báo lỗi kiến trúc | Đọc thông báo: thường do import sai tầng. Xem [ARCHITECTURE.md](../ARCHITECTURE.md) |
