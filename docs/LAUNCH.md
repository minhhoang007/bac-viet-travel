# Launch checklist

Làm một lần trước khi công bố. Những mục có ⚙ đã được `pnpm launch:check https://<domain>` kiểm tự động.
Các mục còn lại phải làm bằng tay.

## 1. Domain và URL
- [ ] Gắn domain riêng trong Vercel (Settings → Domains). Có cả bản `www`, và một bản chuyển hướng về bản kia.
- [ ] `NEXT_PUBLIC_SITE_URL=https://<domain>` cho Production, rồi redeploy.
- [ ] ⚙ HTTPS, canonical URL, sitemap, robots.txt trỏ đúng domain thật (không phải `*.vercel.app` hay localhost).
- [ ] Profile `app` có Google sign-in: thêm `https://<domain>/api/auth/callback/google` vào OAuth client.

## 2. Email không vào spam
Thiếu bước này thì email đăng nhập và email liên hệ sẽ vào thư rác, hoặc không gửi được.

- [ ] Resend → Domains → Add domain. Nên dùng một subdomain, ví dụ `mail.<domain>`.
- [ ] Thêm **đúng các bản ghi Resend hiển thị** vào DNS của domain:
  - **SPF** (TXT, và MX cho bounce): cho phép Resend gửi thay domain của bạn.
  - **DKIM** (TXT `resend._domainkey…`): ký email để chứng minh không bị sửa.
- [ ] Thêm **DMARC** (TXT ở `_dmarc.<domain>`). Bắt đầu nhẹ:
  `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`. Khi báo cáo đã sạch thì nâng lên `p=quarantine`.
- [ ] Chờ Resend báo **Verified**, rồi đặt `EMAIL_FROM="Tên <noreply@mail.<domain>>"`.
  Domain thử nghiệm `resend.dev` chỉ gửi được tới email của chính chủ tài khoản Resend.
- [ ] Gửi thử: form liên hệ và (profile `app`) link đăng nhập tới một hộp Gmail và một hộp Outlook. Không được vào Spam.

## 3. Thanh toán (nếu bật billing hoặc VNPay)
- [ ] Sandbox end to end cho mỗi provider: thanh toán → webhook/IPN → trạng thái hiện đúng → email (nếu có).
- [ ] VNPay: đăng ký IPN URL trên cổng merchant. Production thì `VNPAY_PAYMENT_URL` là URL thật (xác nhận với VNPay).
- [ ] Polar: `POLAR_SERVER=production`, webhook production, sản phẩm production.
- [ ] Thử **một giao dịch thật nhỏ** rồi hoàn tiền, trước khi mở bán.

## 4. Điều khoản và chính sách riêng tư
- [ ] ⚙ `/terms` và `/privacy` mở được.
- [ ] Thay toàn bộ nội dung mẫu trong `content/legal.ts` (đang ghi `TEMPLATE ONLY`). Cập nhật `updated`.
- [ ] Nhờ người có chuyên môn pháp lý xem lại nếu thu tiền hoặc xử lý dữ liệu nhạy cảm.

Prompt mẫu để AI soạn bản nháp (dán vào Claude, sửa phần trong `<…>`):

```text
Soạn bản nháp "Điều khoản sử dụng" và "Chính sách bảo mật" bằng tiếng Việt và tiếng Anh cho website sau.
- Tên doanh nghiệp: <tên>, mã số thuế: <MST>, địa chỉ: <địa chỉ>, email liên hệ: <email>
- Sản phẩm: <mô tả ngắn: bán tour / SaaS / ...>, khách hàng: <cá nhân / doanh nghiệp>, thị trường: Việt Nam
- Dữ liệu thu thập: email, tên, <số điện thoại, dữ liệu thanh toán qua VNPay/Polar, file tải lên, ...>
- Bên thứ ba xử lý dữ liệu: Vercel (hosting), Neon (database), Resend (email), <VNPay, Polar, Cloudflare R2, ...>
- Cookie: phiên đăng nhập, lưu lựa chọn đồng ý analytics; analytics tự lưu trữ, không có quảng cáo
- Người dùng tự xuất và xoá dữ liệu trong trang Tài khoản
- Thanh toán: <chính sách đặt cọc / hoàn tiền / huỷ>
Tuân theo các quy định hiện hành của Việt Nam về bảo vệ dữ liệu cá nhân và thương mại điện tử
(nêu rõ văn bản bạn dựa vào để tôi tự kiểm tra hiệu lực).
Trả về đúng cấu trúc: mảng { heading, body } cho từng văn bản, mỗi mục ngắn gọn, dễ hiểu.
Ghi rõ những chỗ tôi cần tự xác nhận.
```

## 5. SEO và chia sẻ
- [ ] ⚙ Title, meta description, ảnh chia sẻ (`og:image`) có trên trang chủ.
- [ ] Xem thử link trên Zalo, Facebook ([Sharing Debugger](https://developers.facebook.com/tools/debug/)) và X.
- [ ] Gửi `https://<domain>/sitemap.xml` lên Google Search Console.
- [ ] Nội dung mẫu đã thay hết: hero, tính năng, bảng giá, FAQ, bài blog mẫu.
  Testimonials và logo chỉ dùng khi là khách thật, có sự đồng ý của họ.

## 6. Vận hành
- [ ] ⚙ `/api/health` trả 200. Gắn một uptime monitor (Better Stack, UptimeRobot) vào URL này.
- [ ] Neon: biết cách restore theo thời điểm. Trước mỗi lần migration, tạo một branch để chạy thử.
- [ ] Profile `app`: đăng nhập một lần, chạy `pnpm admin:grant <email>` với `DATABASE_URL` production, mở `/admin`.
- [ ] (Nên có) gắn công cụ theo dõi lỗi trong `instrumentation.ts`.
- [ ] Bật analytics module nếu cần đếm lượt xem (có banner đồng ý, không script của bên thứ ba).

## 7. Lần cuối
- [ ] `pnpm launch:check https://<domain>` toàn ✔.
- [ ] Mở site trên điện thoại thật: menu, form, thanh toán.
- [ ] Ghi vào `docs/REUSE-PROOFS.md` của starter những chỗ phải sửa Core/Modules trong dự án này.
