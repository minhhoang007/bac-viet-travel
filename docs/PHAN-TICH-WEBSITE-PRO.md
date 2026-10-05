# Bắc Việt Travel: phân tích để thành website tour chuyên nghiệp

*Ngày 2026-10-05. Chỉ phân tích, chưa code. Starter: `v1.0.1`. Production: https://bac-viet-travel.vercel.app*

## 1. Hiện trạng

**Đã có và chạy thật:**

| Nhóm | Có gì |
|---|---|
| Tour | 6 tour (Hạ Long ×2, Ninh Bình ×2, Sapa ×2), nội dung MDX song ngữ: lịch trình, điểm nổi bật, bao gồm / không bao gồm, giá VND/USD, ảnh |
| Đặt chỗ | Ngày khởi hành có giới hạn chỗ, giữ chỗ 15 phút, trang booking riêng cho khách (link bí mật), cọc 30% |
| Thanh toán | VNPay (sandbox) có IPN và đối soát `querydr`; xử lý thanh toán muộn (`refund_due`) |
| Vận hành | `/admin/bookings`, `/admin/departures`, nhật ký thao tác, email cho khách và đội ngũ, job nhắc lịch và huỷ hold |
| Marketing | Trang chủ (các bước, bảng giá, FAQ), blog 6 bài (3 vi + 3 en), nút Zalo / WhatsApp / hotline, SEO cơ bản (sitemap, hreflang, ảnh chia sẻ, JSON-LD), analytics có xin đồng ý cookie |
| Kỹ thuật | Next.js trên Vercel, Neon, Resend; security headers; `launch:check` đạt 13/13; test tự động |

**Còn là dữ liệu demo, phải thay trước khi bán thật:**
- `config/contact.ts`: số giấy phép `01-xxx/2026/TCDL-GP LHQT (demo)`, địa chỉ "Số 1 Phố Demo", hotline và Zalo `0900000000`.
- Toàn bộ ảnh là ảnh Unsplash (`/credits`), không phải ảnh tour thật của công ty.
- Email gửi từ `resend.dev`, nên chỉ tới được email chủ tài khoản. Domain là `*.vercel.app`.
- VNPay vẫn ở sandbox.

## 2. Khoảng cách so với một website tour chuyên nghiệp

Mức ưu tiên: **P0** = bắt buộc trước khi nhận tiền thật · **P1** = tăng chuyển đổi rõ rệt · **P2** = mở rộng, tối ưu.
Công sức: S (≤1 ngày) · M (2–4 ngày) · L (≥1 tuần). "Ai làm": **Chủ** = việc giấy tờ / tài khoản / nội dung · **Project** = code trong repo Bắc Việt · **Starter** = nên đưa vào starter vì project nào cũng cần.

### A. Pháp lý và niềm tin (P0)

Đây là điều kiện để bán tour online hợp pháp ở Việt Nam, và cũng là thứ khách nhìn đầu tiên để quyết định có tin không.

| # | Yếu tố | Vì sao | Ưu tiên | Ai làm | Công sức |
|---|---|---|---|---|---|
| A1 | **Giấy phép lữ hành** (nội địa / quốc tế) hiển thị đúng số thật | Kinh doanh lữ hành là ngành nghề có điều kiện (Luật Du lịch) | P0 | Chủ | — |
| A2 | **Thông báo website TMĐT với Bộ Công Thương** và gắn logo "Đã thông báo" | Bắt buộc với website bán hàng (NĐ 52/2013, sửa đổi bởi NĐ 85/2021); hồ sơ cần cả giấy phép ngành nghề | P0 | Chủ (có thể thuê dịch vụ) + Project gắn logo | S |
| A3 | Footer đầy đủ: tên pháp nhân, MST, địa chỉ, người đại diện, hotline, email | Yêu cầu thông tin của website TMĐT; tạo niềm tin | P0 | Chủ + Project | S |
| A4 | **Chính sách huỷ / đổi / hoàn tiền** chi tiết theo mốc ngày (ví dụ: huỷ trước 7 ngày hoàn 100% cọc…), **chính sách thanh toán**, **chính sách bảo mật** theo NĐ 13/2023 (bảo vệ dữ liệu cá nhân) | Bắt buộc với website TMĐT; khách hỏi nhiều nhất trước khi cọc | P0 | Chủ soạn + Project trang | S–M |
| A5 | Domain riêng (ví dụ `bacviettravel.vn`) + email gửi từ domain (xác minh trên Resend: SPF/DKIM/DMARC) | Email hiện chỉ tới được email chủ tài khoản; `vercel.app` trông như bản thử | P0 | Chủ mua domain + Project cấu hình | S |
| A6 | **Ảnh và video thật** của tour, xe, du thuyền, hướng dẫn viên | Ảnh stock làm giảm niềm tin; khách du lịch so ảnh rất kỹ | P0–P1 | Chủ | — |
| A7 | Trang **Giới thiệu**: câu chuyện công ty, đội ngũ, văn phòng, giấy tờ, đối tác (du thuyền, nhà xe) | Tín hiệu niềm tin cơ bản | P1 | Chủ nội dung + Project | S |
| A8 | **Đánh giá thật**: điểm Google / TripAdvisor, đánh giá sau chuyến trên site | Đánh giá là yếu tố chuyển đổi mạnh nhất của tour | P1 | Project (form đánh giá sau chuyến) + Chủ (hồ sơ Google, TripAdvisor) | M |
| A9 | Huy hiệu thanh toán an toàn (VNPay, thẻ), cam kết "giá đã gồm…", "không phí ẩn" | Giảm lo ngại lúc thanh toán | P1 | Project | S |

### B. Sản phẩm và nội dung tour

| # | Yếu tố | Hiện tại | Đề xuất | Ưu tiên | Công sức |
|---|---|---|---|---|---|
| B1 | Số lượng tour | 6 | 15–30 tour trên 3 điểm đến chính, cộng thêm Hà Giang, Mai Châu, Cát Bà, Hà Nội city tour | P1 | Chủ nội dung |
| B2 | **Giá theo đối tượng** | Một giá/người | Người lớn / trẻ em (theo tuổi) / em bé; phụ thu phòng đơn; giá theo nhóm (càng đông càng rẻ) | P1 | M |
| B3 | **Giá theo mùa / ngày** | Giá cố định trong MDX | Giá theo ngày khởi hành (lễ Tết, cuối tuần, cao điểm); đã có cột `price_vnd` trên departure làm nền | P1 | M |
| B4 | Tour ghép vs **tour riêng** (private) | Chỉ ghép | Tuỳ chọn tour riêng có giá riêng; form "thiết kế tour theo yêu cầu" | P1 | M |
| B5 | **Hạng dịch vụ** | Một hạng | Ví dụ du thuyền 3★ / 4★ / 5★, xe limousine / xe thường, có giá chênh | P2 | M |
| B6 | **Dịch vụ thêm** (add-on) | Không | Đón tại khách sạn, phòng đơn, thuê xe máy Sapa, bảo hiểm, ăn chay | P1 | M |
| B7 | Thông tin thực tế từng tour | Một phần | Điểm và giờ đón, bản đồ lịch trình, mức độ vận động, cần mang gì, thời tiết theo tháng, chính sách huỷ riêng, FAQ riêng | P1 | S–M |
| B8 | Combo / gói nhiều ngày | Không | Gói "Miền Bắc 5–7 ngày" (Hà Nội – Ninh Bình – Hạ Long – Sapa) | P2 | M |
| B9 | **Quản lý tour trong admin** | Tour là file MDX: muốn sửa phải sửa code và deploy | Admin tạo / sửa tour, ảnh, giá, lịch khởi hành (CMS) | P1 | L |

### C. Tìm kiếm và khám phá

| # | Yếu tố | Đề xuất | Ưu tiên | Công sức |
|---|---|---|---|---|
| C1 | **Trang điểm đến** | `/diem-den/ha-long`, `/ninh-binh`, `/sapa`: giới thiệu, thời điểm đẹp, tour, blog liên quan. Đây là trang SEO quan trọng nhất | P1 | M |
| C2 | Bộ lọc và tìm kiếm | Lọc theo điểm đến, số ngày, giá, loại (ghép / riêng / trekking / du thuyền), ngày khởi hành | P1 | M |
| C3 | Lịch khởi hành trực quan | Lịch tháng có số chỗ còn và giá theo ngày (thay cho danh sách) | P1 | M |
| C4 | Tour tương tự / đã xem gần đây | Giữ khách ở lại site | P2 | S |
| C5 | Yêu thích / chia sẻ | Lưu tour, chia sẻ qua Zalo / Facebook | P2 | S |

### D. Đặt chỗ và thanh toán

| # | Yếu tố | Hiện tại | Đề xuất | Ưu tiên | Công sức |
|---|---|---|---|---|---|
| D1 | VNPay production | Sandbox | Ký hợp đồng VNPay, chạy bộ test SIT, đổi key | P0 | Chủ + S |
| D2 | **Chuyển khoản VietQR** | Không | Mã QR theo đúng số tiền và nội dung `BV-XXXX`; đối soát bằng webhook ngân hàng (Casso / SePay…) hoặc admin xác nhận tay. Rất phổ biến với khách Việt | P1 | M |
| D3 | **Thẻ quốc tế** cho khách nước ngoài | Không (VNPay chủ yếu cho thẻ nội địa / QR) | OnePay / Stripe / PayPal, giá USD | P1 (nếu nhắm khách quốc tế) | M–L |
| D4 | Ví MoMo / ZaloPay | Không | Thêm cổng | P2 | M |
| D5 | Thanh toán đủ / phần còn lại online | Chỉ cọc 30% | Cho chọn trả đủ; nhắc và link trả phần còn lại trước ngày đi | P1 | M |
| D6 | **Mã giảm giá / khuyến mãi** | Không | Mã theo %, số tiền, hạn dùng, giới hạn lượt; giá "early bird" | P1 | M |
| D7 | Thông tin hành khách | Tên, email, SĐT, số người | Danh sách tên và năm sinh từng khách (cần cho bảo hiểm, du thuyền); hộ chiếu với khách quốc tế; yêu cầu đặc biệt | P1 | M |
| D8 | **Voucher / xác nhận PDF** | Email + trang booking | PDF có mã QR, điểm đón, liên hệ HDV; thêm vào lịch (ICS) | P1 | M |
| D9 | Tự đổi / huỷ | Admin làm | Khách gửi yêu cầu đổi ngày / huỷ từ trang booking; áp chính sách huỷ tự động; hoàn tiền | P2 | L |
| D10 | Hoá đơn VAT điện tử | Không | Thu thông tin xuất hoá đơn; kết nối nhà cung cấp hoá đơn (MISA, Viettel…) | P1 (khách doanh nghiệp) | M |
| D11 | Giữ chỗ không cần cọc (thanh toán sau) | Không | Cho khách đoàn / doanh nghiệp: giữ chỗ chờ admin duyệt | P2 | M |

### E. Liên lạc và chăm sóc khách

| # | Yếu tố | Đề xuất | Ưu tiên | Công sức |
|---|---|---|---|---|
| E1 | **Zalo OA** + tin nhắn ZNS | Gửi xác nhận, nhắc lịch qua Zalo (khách Việt đọc Zalo hơn email) | P1 | M |
| E2 | Live chat / chat Zalo trên site | Widget chat; giờ làm việc; trả lời nhanh | P1 | S |
| E3 | Form tư vấn nhanh | "Gọi lại cho tôi" trên trang tour, kèm ngày dự kiến và số người | P1 | S |
| E4 | Khảo sát sau chuyến | Tự gửi sau ngày về, xin đánh giá và dẫn tới Google / TripAdvisor | P1 | S–M |
| E5 | Trang trợ giúp / FAQ chung | Thanh toán, huỷ, đón khách, trẻ em, thời tiết | P1 | S |

### F. Khách quốc tế

| # | Yếu tố | Đề xuất | Ưu tiên |
|---|---|---|---|
| F1 | Nội dung tiếng Anh do người viết chuẩn | Văn phong bản xứ, đúng thuật ngữ du lịch | P1 |
| F2 | Tiền tệ | Hiển thị USD (đã có giá USD) và thanh toán USD (D3) | P1 |
| F3 | TripAdvisor / Google reviews | Khách quốc tế tin TripAdvisor | P1 |
| F4 | WhatsApp làm kênh chính | Đã có nút; thêm số thật, giờ trả lời | P0 |
| F5 | Kênh bán OTA | Viator, GetYourGuide, Klook, TourRadar: thêm khách, nhưng mất hoa hồng 20–30%; cần đồng bộ lịch chỗ | P2 |

### G. SEO, marketing, đo lường

| # | Yếu tố | Đề xuất | Ưu tiên | Công sức |
|---|---|---|---|---|
| G1 | **Google Business Profile** | Văn phòng tại Hà Nội, ảnh, đánh giá: nguồn khách địa phương lớn | P0 | Chủ |
| G2 | Schema chi tiết | `TouristTrip` / `Product` + `Offer` + `AggregateRating` + `FAQPage` trên trang tour, để có giá và sao trên Google | P1 | S–M |
| G3 | Nội dung SEO | Trang điểm đến (C1), 2–4 bài blog/tháng theo từ khoá ("tour Hạ Long 2 ngày 1 đêm", "kinh nghiệm Sapa tháng 10"…) | P1 | Chủ + S |
| G4 | **Đo lường chuyển đổi** | GA4 / Meta Pixel / Google Ads conversion (có đồng ý cookie); phễu: xem tour → giữ chỗ → cọc. Analytics tự lưu hiện chỉ đếm lượt xem | P1 | M |
| G5 | Email marketing | Bản tin, ưu đãi mùa (cần khách đồng ý) | P2 | M |
| G6 | Chương trình giới thiệu / cộng tác viên | Mã giới thiệu, hoa hồng | P2 | M–L |
| G7 | Tốc độ và ảnh | Ảnh WebP/AVIF qua `next/image`, theo dõi Core Web Vitals | P1 | S |
| G8 | Tìm kiếm bằng AI | Nội dung rõ ràng, FAQ, dữ liệu có cấu trúc, `llms.txt` | P2 | S |

### H. Vận hành và quản trị

| # | Yếu tố | Hiện tại | Đề xuất | Ưu tiên | Công sức |
|---|---|---|---|---|---|
| H1 | **Danh sách khách theo chuyến** | Xem từng booking | Bảng khách theo ngày khởi hành (tên, SĐT, điểm đón, ghi chú), in hoặc xuất Excel cho HDV và nhà xe | P1 | M |
| H2 | Phân quyền nhân viên | Chỉ `admin` | Vai trò: quản lý / sale / kế toán / HDV (xem chuyến của mình) | P1 | M |
| H3 | Báo cáo | Không | Doanh thu, số khách, tỉ lệ lấp chỗ theo tour / tháng, nguồn khách | P1 | M |
| H4 | Hoàn tiền | Đánh dấu `refund_due` | Quy trình hoàn tiền (VNPay refund API hoặc chuyển khoản) có ghi nhận | P1 | M |
| H5 | Tạo lịch khởi hành hàng loạt | Đã có seed | Admin tạo theo quy tắc (hằng ngày / thứ 7, sức chứa, giá) | P1 | S–M |
| H6 | Đặt chỗ thủ công | Không | Sale nhập booking từ điện thoại / Zalo vào hệ thống, giữ chỗ chung một nguồn | P1 | M |
| H7 | Quản lý nhà cung cấp | Không | Du thuyền, xe, HDV: giá vốn, lịch, liên hệ, để tính lãi theo chuyến | P2 | L |

### I. Kỹ thuật và chất lượng

| # | Yếu tố | Hiện tại | Đề xuất | Ưu tiên |
|---|---|---|---|---|
| I1 | Theo dõi lỗi và cảnh báo | Log Vercel | Sentry (hoặc tương đương) + cảnh báo khi IPN lỗi hay đối soát tìm thấy thanh toán bị sót | P0 |
| I2 | Uptime | Không | UptimeRobot / Better Stack gọi `/api/health` | P0 |
| I3 | Sao lưu DB | Neon có point-in-time (theo gói) | Kiểm tra gói Neon, thử khôi phục một lần; Neon region gần Việt Nam (Singapore) để nhanh hơn (hiện `us-east-1`) | P0–P1 |
| I4 | Job chạy thường xuyên hơn | Vercel Cron **mỗi ngày một lần** | Huỷ hold, nhắc lịch và đối soát VNPay cần chạy mỗi 5–15 phút (Vercel Pro hoặc cron ngoài gọi `/api/jobs/run`) | P0 |
| I5 | Chống spam đặt chỗ | Có rate limit | Thêm Turnstile / reCAPTCHA khi bị spam | P2 |
| I6 | Hàng đợi email bị kẹt | 3 job email 403 (booking thử) | Tự hết sau số lần thử; dọn khi có domain thật | P0 (đi cùng A5) |

## 3. Lộ trình đề xuất

**Giai đoạn 0, sẵn sàng bán thật (1–2 tuần, phần lớn là việc của chủ):**
A1–A6 (giấy phép, Bộ Công Thương, footer, chính sách, domain + email, ảnh thật), D1 (VNPay production), F4, G1, I1–I4, I6.
Phần code: trang chính sách, footer, logo Bộ Công Thương, domain, Sentry / uptime, cron dày hơn. Công sức khoảng **M**.

**Giai đoạn 1, chuyển đổi tốt (3–5 tuần):**
B2–B4, B6–B7, C1–C3, D2, D5–D8, E1–E5, G2–G4, H1, H5–H6, A7–A9.
Ưu tiên trong giai đoạn: trang điểm đến (C1), giá theo đối tượng (B2), VietQR (D2), voucher PDF (D8), danh sách khách theo chuyến (H1), đánh giá (A8).

**Giai đoạn 2, mở rộng (khi có doanh thu đều):**
B9 (CMS tour), D3 (thẻ quốc tế), H2–H4, D9–D11, B5, B8, F5, G5–G8, H7.

**Nên đưa vào starter** (project khác cũng cần): trang chính sách mẫu và footer pháp lý theo luật Việt Nam, VietQR + webhook ngân hàng, voucher PDF, mã giảm giá, Sentry + cảnh báo, ghi chú về tần suất cron trong DEPLOY.

## 4. Câu hỏi cần chủ quyết định

1. **Khách mục tiêu:** chủ yếu khách Việt, khách quốc tế, hay cả hai? Câu trả lời quyết định D3 (thẻ quốc tế), F (khách quốc tế) và ngôn ngữ ưu tiên.
2. **Giấy phép:** công ty đã có giấy phép lữ hành chưa (nội địa hay quốc tế)? Đây là điều kiện để thông báo với Bộ Công Thương và nhận tiền thật.
3. **Mô hình tour:** chỉ tour ghép theo lịch, hay cả tour riêng và tour theo yêu cầu?
4. **Thanh toán:** cọc 30% hay cho trả đủ? Có nhận chuyển khoản QR không? Chính sách huỷ cụ thể (mốc ngày, % hoàn)?
5. **Ai cập nhật tour hằng ngày?** Nếu là nhân viên không biết code thì cần CMS (B9) sớm hơn.
6. **Ngân sách vận hành:** Vercel Pro (cron dày, nhiều tài nguyên hơn), Neon trả phí, Sentry, domain, Zalo OA / ZNS, dịch vụ hoá đơn.
7. **Kênh OTA:** có muốn bán thêm trên Viator / Klook / GetYourGuide không?

## Nguồn tham khảo

- Thông báo website TMĐT với Bộ Công Thương: [tenten.vn](https://tenten.vn/tin-tuc/thong-bao-website-voi-bo-cong-thuong-huong-dan/), [Nghị định 85/2021 (mona.media)](https://mona.media/nghi-dinh-85-2021-nd-cp-thuong-mai-dien-tu/)
- Chuyển đổi và tín hiệu niềm tin cho website tour: [Rework: Website Conversion for Travel](https://resources.rework.com/libraries/travel-tour-growth/website-conversion-for-travel), [WP Travel Engine: 23 features](https://wptravelengine.com/features-for-travel-agency-websites/), [Physcode: tour booking website features](https://physcode.com/tour-booking-website-features/), [Captainbook: AI search for tour businesses](https://www.captainbook.io/blog/how-to-prepare-your-tour-business-for-ai-search-(2026))
- Tham khảo đối thủ miền Bắc: [TourRadar Vietnam](https://www.tourradar.com/d/vietnam), [GADT Travel](https://gadttravel.com/), [WaytoVietnam](https://waytovietnam.com/), [TripAdvisor: Ninh Binh – Ha Long 3N2Đ](https://www.tripadvisor.com/AttractionProductReview-g293924-d27099815-Ninh_Binh_Ha_Long_3_days_2_nights_2026_Updated_Travel_Package-Hanoi.html)

*Các yêu cầu pháp lý ở đây là tóm tắt để định hướng. Trước khi bán thật, nên xác nhận với luật sư hoặc đơn vị dịch vụ pháp lý.*

## 5. Quyết định của chủ (2026-10-05) và lộ trình điều chỉnh

| Câu hỏi | Trả lời | Hệ quả |
|---|---|---|
| Khách mục tiêu | Cả khách Việt và quốc tế | Song ngữ đầy đủ; thẻ quốc tế qua **VNPay** (hỗ trợ Visa/Master/JCB, phí khoảng 2%) thay vì thêm cổng; WhatsApp + Zalo |
| Giấy phép | Công ty đã có | Làm được ngay việc thông báo Bộ Công Thương và footer pháp lý |
| Mô hình tour | Ghép + riêng; tour theo yêu cầu nghiên cứu sau | Giá theo đối tượng (ghép) và giá theo số khách (riêng) |
| Thanh toán | Cọc + chuyển khoản; chính sách cụ thể sau | VietQR (admin xác nhận) đi cùng VNPay; trang chính sách để khung, điền sau |
| Người vận hành | Chủ + marketing (không lập trình) | **CMS sửa tour trong admin** chuyển lên giai đoạn 0 |
| Ngân sách | 2 triệu/tháng giai đoạn đầu | Xem bảng chi phí bên dưới |
| OTA | Kết hợp Klook… giai đoạn đầu | **Đặt chỗ thủ công / nhập booking OTA** để chung một nguồn số chỗ (giai đoạn 0) |

### Chi phí ước tính mỗi tháng (giá tham khảo, cần kiểm tra lại lúc mua)

| Hạng mục | Lựa chọn | Ước tính |
|---|---|---|
| Hosting | **Vercel Pro**, bắt buộc khi bán (gói Hobby cấm thương mại); có cron mỗi phút | ~$20 ≈ 520.000đ |
| Database | Neon Free (0,5 GB), chuyển region sang Singapore | 0đ (nâng gói khi dữ liệu lớn) |
| Domain | `.vn` hoặc `.com` (trả theo năm) | ~30.000–70.000đ/tháng |
| Email gửi tự động | Resend Free (3.000 email/tháng) | 0đ |
| Theo dõi lỗi / uptime | Sentry Free, UptimeRobot Free | 0đ |
| Zalo OA / ZNS | OA miễn phí; ZNS tính theo tin | ~50.000–150.000đ |
| Thanh toán | VNPay (thu theo % giao dịch), OTA (hoa hồng) | Theo doanh thu, không cố định |
| **Tổng cố định** | | **~650.000–750.000đ**, còn dư cho ảnh / quảng cáo |

### Giai đoạn 0 điều chỉnh: "demo như web thật"

1. Thông tin công ty thật: tên pháp nhân, MST, giấy phép, địa chỉ, hotline, Zalo, WhatsApp, email; footer pháp lý; trang Giới thiệu.
2. Trang chính sách: huỷ / hoàn tiền, thanh toán, bảo mật (NĐ 13/2023), điều khoản. Dựng khung, nội dung điền khi có chính sách.
3. Domain + email từ domain; logo Bộ Công Thương sau khi thông báo xong.
4. Hạ tầng: Vercel Pro, cron mỗi 5–10 phút, Neon Singapore, Sentry + uptime.
5. Thanh toán: VNPay production (thẻ nội địa, QR, thẻ quốc tế) + chuyển khoản VietQR có admin xác nhận.
6. Tour ghép + riêng: giá người lớn / trẻ em / em bé; tour riêng có giá theo số khách.
7. **CMS tour trong admin**: thêm / sửa tour, ảnh, giá, lịch khởi hành, không cần code.
8. **Nhập booking thủ công / từ OTA** để giữ chỗ chung một nguồn.
9. Ảnh thật (chủ cung cấp).

Giai đoạn 1 giữ như mục 3: trang điểm đến, lịch khởi hành trực quan, voucher PDF, Zalo OA, đánh giá, schema, đo lường chuyển đổi, danh sách khách theo chuyến, mã giảm giá.

Nguồn: [Vercel Hobby (commercial use)](https://vercel.com/docs/plans/hobby), [VNPAY: thẻ quốc tế](https://vnpayment.vnpay.vn/).
