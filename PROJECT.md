# Bắc Việt Travel (demo)

Website công ty du lịch: tour Hạ Long, Ninh Bình, Sapa khởi hành từ Hà Nội, **đặt tour online**.
Dựng từ Minh Starter `v1.0.0-rc.10` (profile `app`, modules `email`, `blog`).

## Phần riêng của dự án
| Đường dẫn | Nội dung |
|---|---|
| `content/tours/<vi\|en>/<slug>.mdx` | Danh mục tour (frontmatter kiểm tra bằng zod; cùng slug cho vi/en) |
| `product/tours/` | Đọc danh mục, form yêu cầu tư vấn (email cho đội + email xác nhận cho khách), nguồn ảnh |
| `product/schema/booking.ts` | Bảng `departures` (lịch khởi hành, số chỗ) và `bookings` (đơn đặt) |
| `product/booking/` | Quy tắc giá/cọc (`rules.ts`), kiểm tra form, dịch vụ giữ chỗ, đặt cọc VNPay (`deposits.ts`), email, nội dung giao diện |
| `product/components/` | Thẻ tour, form tư vấn, form đặt tour, đồng hồ giữ chỗ, nút liên hệ nhanh |
| `product/home.tsx`, `product/layout.tsx` | Các khối trang chủ, dòng giấy phép + nút liên hệ trên mọi trang |
| `config/contact.ts` | **Số Zalo, WhatsApp, hotline, email, giấy phép: đang là số demo, phải thay** |
| `app/[locale]/tours`, `app/[locale]/credits` | Trang tour, trang nguồn ảnh |
| `app/[locale]/tours/[slug]/book`, `app/[locale]/booking/[code]` | Trang đặt tour, trang đơn của khách (link bí mật) |
| `app/[locale]/booking/return`, `app/api/booking/vnpay/ipn` | VNPay quay về (chỉ hiển thị), IPN (nơi duy nhất chốt tiền cọc) |
| `scripts/seed-departures.ts` | Tạo lịch khởi hành demo 8 tuần (`--demo-full`: thêm ngày gần đầy / hết chỗ) |
| `public/tours/` | Ảnh Unsplash (Unsplash License), ghi nguồn tại `/credits` |

## Đặt tour online
- Khách không cần đăng nhập. Chọn ngày → điền thông tin → **giữ chỗ 15 phút** → trang đơn `/booking/BV-XXXXXX?t=<mã bí mật>`.
- Quy tắc (`product/booking/rules.ts`): cọc 30%, trẻ em 5–10 tuổi 75% giá, dưới 5 tuổi miễn phí và không tính chỗ,
  tối đa 10 khách/đơn, đặt trước ít nhất 2 ngày (giờ Việt Nam).
- Không bán trùng chỗ: tạo đơn khoá dòng lịch khởi hành trong transaction (kiểm thử: 10 khách tranh 2 chỗ → đúng 2 đơn).
- Giữ chỗ hết hạn được nhả ngay khi đếm chỗ (không cần chờ job).
- Mã tra cứu chỉ lưu bản băm sha256; sai mã = không tìm thấy đơn.
- **Đặt cọc VNPay:** trang đơn → VNPay → IPN kiểm tra chữ ký + số tiền, xử lý đúng một lần → `deposit_paid` + email cho
  khách (kèm link) và đội. Tiền về sau khi hết giữ chỗ: còn chỗ thì nhận, hết chỗ thì `refund_due` (đội hoàn tiền).
  Mã link chỉ lưu tạm trên lượt thanh toán đến khi IPN gửi email, rồi xoá.
- Đang dùng **VNPay sandbox** (biểu ngữ "Chế độ thử nghiệm" + thẻ test NCB). IPN URL đăng ký với VNPay:
  `https://<domain>/api/booking/vnpay/ipn`.
- Lộ trình: Phase 1 ✅ lịch + giữ chỗ · Phase 2 ✅ đặt cọc VNPay sandbox + email · Phase 3 trang quản trị · Phase 4 deploy.

## Chạy local
```
pnpm db:up                                   # Postgres của starter (cổng 54329), DB bac_viet
pnpm db:migrate
node --env-file=.env.local scripts/seed-departures.ts --demo-full
pnpm dev
```
- Integration test: `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54329/bac_viet_test pnpm test:int`
- E2E: `pnpm build && pnpm test:e2e` (tự reset + seed DB `bac_viet_e2e`).

## Trước khi chạy thật
- Thay toàn bộ thông tin trong `config/contact.ts` và tên công ty.
- Giá tour trong `content/tours/` là giá tham khảo cho demo.
- Thay đánh giá mẫu trong `product/content.ts` bằng đánh giá thật.
- Sửa `content/legal.ts` (điều khoản đặt tour, chính sách huỷ, bảo mật).
- Env: `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`,
  `EMAIL_FROM`, `CONTACT_TO_EMAIL`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL` (mẫu: `.env.vercel`, không commit).
- Khi có giấy phép: đổi sang tài khoản VNPay thật (`VNPAY_PAYMENT_URL=https://pay.vnpay.vn/vpcpay.html`), biểu ngữ tự tắt.

## Ghi chú cho starter (phát hiện khi làm dự án)
- **G7** ✅ (rc.10): `createProduct(db, ctx)` nhận logger, mail, rate limiter, payments, jobs.
- **G8** ✅ (rc.10): VNPay dùng được không cần module billing (`ctx.payments.vnpay`).

## Nâng cấp starter
`git fetch starter --tags && git merge v1.0.0-rc.N` (xem docs/UPGRADING.md).
