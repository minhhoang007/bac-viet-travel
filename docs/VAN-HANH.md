# Vận hành Bắc Việt Travel: checklist hạ tầng

Mục tiêu: chạy như web thật với ngân sách khoảng 2 triệu/tháng. Mỗi bước ghi rõ **bạn làm** (tài khoản, thanh toán) và **dev làm** (code, cấu hình).

## 1. Vercel Pro (bắt buộc khi bán thật)

Gói Hobby (miễn phí) cấm dùng cho mục đích thương mại; website có nhận thanh toán phải dùng Pro (~$20/tháng).

- **Bạn:** Vercel → Settings → Billing → nâng team `hoangvanminh007s-projects` lên **Pro**.
- **Dev, sau khi lên Pro:**
  - Đổi cron trong `vercel.json` từ `0 3 * * *` (1 lần/ngày) sang `*/10 * * * *` (mỗi 10 phút). Gói Hobby không cho deploy cron dày hơn 1 lần/ngày.
  - Kiểm tra: log Vercel có `jobs.tick` mỗi 10 phút. Huỷ hold, nhắc lịch và đối soát VNPay chạy đúng giờ.

## 2. Database ở Singapore

Neon hiện ở `us-east-1` (Mỹ), mỗi truy vấn đi vòng nửa vòng trái đất.

- **Bạn:** Neon → New Project → region **AWS Singapore (ap-southeast-1)**, gói Free → gửi dev chuỗi kết nối (gửi riêng, không dán vào chat công khai).
- **Dev:**
  1. `pg_dump` dữ liệu hiện tại → `pg_restore` vào project mới (dữ liệu nhỏ, vài phút).
  2. Đổi `DATABASE_URL` trên Vercel, redeploy, kiểm tra `/api/health` và một booking thử.
  3. Giữ project cũ 1 tuần rồi xoá.
- Nếu Vercel Functions vẫn ở Mỹ: đặt region function `sin1` (Singapore) trong cấu hình project (Pro).

## 3. Domain và email

- **Bạn:** mua domain (`.vn` hoặc `.com`); gửi dev quyền quản lý DNS hoặc làm theo hướng dẫn.
- **Dev:**
  1. Vercel → Domains → thêm domain, trỏ DNS (A / CNAME).
  2. `NEXT_PUBLIC_SITE_URL` = domain mới; redeploy (canonical, sitemap, email dùng domain này).
  3. Resend → Domains → thêm domain, thêm bản ghi SPF / DKIM / DMARC; `EMAIL_FROM=booking@<domain>`. Sau đó email tới được **mọi khách** (hiện chỉ tới email chủ tài khoản Resend).
  4. Đăng ký IPN URL mới với VNPay: `https://<domain>/api/booking/vnpay/ipn`.
  5. `pnpm launch:check https://<domain>` phải đạt hết.

## 4. Theo dõi lỗi và uptime (miễn phí)

- **Bạn:** tạo tài khoản Sentry (Free) và UptimeRobot (Free).
- **Dev:**
  - Sentry: gắn SDK, cảnh báo email khi có lỗi mới, đặc biệt `booking.deposit_ipn_failed` và `booking.deposit_reconciled` (IPN bị sót).
  - UptimeRobot: kiểm tra `https://<domain>/api/health` mỗi 5 phút, báo qua email / Zalo.

## 5. VNPay production

- **Bạn:** ký hợp đồng với VNPay (cần giấy phép lữ hành, ĐKKD). Nếu VNPay yêu cầu chạy bộ test SIT mà trang SIT báo 403: gửi ảnh lỗi cho `support.vnpayment@vnpay.vn`.
- **Dev:** đổi `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL` sang production trên Vercel; thử một giao dịch nhỏ thật; kiểm tra IPN và đối soát.

## 6. Thông tin công ty (thay dữ liệu demo)

Một file duy nhất: `config/contact.ts`. Gửi dev: tên pháp nhân, MST, số và loại giấy phép lữ hành, người đại diện, địa chỉ, hotline, Zalo, WhatsApp, email, giờ làm việc. Sau khi thông báo website với Bộ Công Thương: link xác nhận (`moitNoticeUrl`) để hiện logo.

## 7. Chuyển khoản VietQR (nhận cọc qua ngân hàng)

**Trước khi bán thật:** sửa `config/bank-transfer.ts`: mã BIN ngân hàng, số tài khoản, tên chủ tài khoản (viết hoa, không dấu, đúng như ngân hàng hiển thị), rồi đặt `demo: false`. Khi còn `demo: true`, lựa chọn chuyển khoản chỉ hiện ở chế độ VNPay sandbox, kèm cảnh báo "KHÔNG chuyển tiền thật".

**Hằng ngày (nhân viên):**
1. Khách chọn "Chuyển khoản ngân hàng" trên trang booking: chỗ được giữ 2 giờ; đơn hiện ở mục **Cần xử lý** trong /admin/bookings.
2. Khi tiền vào tài khoản, tìm đơn theo **nội dung chuyển khoản** (mã đơn không có gạch ngang, ví dụ `BV7K3Q9X` = đơn `BV-7K3Q9X`).
3. Mở đơn → khung **Đã nhận chuyển khoản** → kiểm tra số tiền, nhập mã giao dịch ngân hàng → **Ghi nhận tiền cọc**. Khách nhận email xác nhận cọc ngay; thao tác được ghi lịch sử.
4. Tiền ít hơn tiền cọc: hệ thống không ghi nhận, liên hệ khách chuyển thêm. Tiền đến muộn khi chỗ đã hết: đơn chuyển sang **Chờ hoàn tiền**.
5. Khách chuyển khoản mà không bấm chọn trên web (hoặc sau khi hết giờ giữ chỗ): vẫn ghi nhận được ở trang đơn như trên.

Tự động xác nhận qua webhook ngân hàng (Casso, SePay…) có thể thêm sau khi đăng ký dịch vụ.

## Chi phí cố định ước tính

| Hạng mục | Ước tính/tháng |
|---|---|
| Vercel Pro | ~520.000đ |
| Domain (chia theo tháng) | ~30.000–70.000đ |
| Neon, Resend, Sentry, UptimeRobot (gói Free) | 0đ |
| Zalo ZNS (khi dùng) | ~50.000–150.000đ |
| **Tổng** | **~650.000–750.000đ** |

VNPay và OTA thu theo % giao dịch, không cố định.
