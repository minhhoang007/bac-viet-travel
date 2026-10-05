# CMS cho Bắc Việt Travel: phân tích (chưa code)

*2026-10-05. Bối cảnh: chủ doanh nghiệp và marketing vận hành, không lập trình; ngân sách ~2 triệu/tháng; bán cho khách Việt + quốc tế; tour ghép + riêng.*

## 1. Hiện trạng

| Nội dung | Lưu ở đâu | Ai sửa được hôm nay |
|---|---|---|
| Tour (tên, mô tả, lịch trình, bao gồm, giá niêm yết, giá tour riêng, ảnh) | File MDX `content/tours/{vi,en}/*.mdx` + ảnh trong `public/tours/` (9 ảnh, 4,1 MB) | **Chỉ dev**: sửa file → commit → deploy |
| Ngày khởi hành, số chỗ, giá theo ngày | Database (`departures`) | Admin `/admin/departures` ✅ |
| Booking | Database | Admin ✅ |
| Blog (6 bài) | File MDX `content/blog/` | **Chỉ dev** |
| Trang chủ, Giới thiệu, chính sách | File TypeScript (`content/`, `product/about.ts`, `product/policies.ts`) | **Chỉ dev** |

Catalog tour được đọc ở 12 chỗ (trang tour, đặt chỗ, admin, trang chủ, manifest…), qua một hàm duy nhất `getTourCatalog()`. Nhờ vậy, đổi nguồn dữ liệu sang database không phải sửa từng trang.

## 2. Yêu cầu

**Bắt buộc:**
1. Thêm / sửa / ẩn tour không cần dev, có hiệu lực **ngay** (không chờ deploy).
2. Song ngữ vi + en trên cùng một màn hình, báo rõ bản nào còn thiếu.
3. Upload ảnh (kéo thả), sắp xếp ảnh, chọn ảnh bìa; ảnh tối ưu tự động (WebP, đúng kích thước).
4. Sửa lịch trình, điểm nổi bật, bao gồm / không bao gồm dạng danh sách (không phải gõ cú pháp).
5. Giá niêm yết + bảng giá tour riêng.
6. Không làm hỏng SEO: URL giữ nguyên, trang vẫn tải nhanh, sitemap tự cập nhật.
7. Không vượt ngân sách.

**Nên có:**
- Lưu nháp / xem trước trước khi công khai.
- Nhật ký ai sửa gì (đã có `audit_logs` của admin).
- Blog sửa được trong admin.

## 3. Các phương án

| | **A. CMS trong admin (DB)** | **B. CMS sửa file qua Git** (Keystatic / Decap / Tina) | **C. Headless CMS thuê ngoài** (Sanity, Contentful…) |
|---|---|---|---|
| Cách chạy | Tour lưu trong Postgres; admin có form sửa; lưu xong trang cập nhật ngay | Giao diện sửa file MDX, mỗi lần lưu = một commit lên GitHub → Vercel build lại | Dữ liệu nằm ở dịch vụ ngoài; site gọi API của họ |
| Hiệu lực sau khi lưu | **Tức thì** | **1–3 phút** (chờ build); nhiều người sửa = nhiều lần build | Tức thì (qua webhook / ISR) |
| Người sửa cần | Tài khoản admin hiện có | **Tài khoản GitHub** + quyền repo | Tài khoản trên dịch vụ đó |
| Ảnh | Upload lên kho ảnh (R2 / Vercel Blob) | Ảnh commit vào repo (repo phình dần) hoặc dịch vụ ngoài | Kho ảnh của dịch vụ (gói free có giới hạn) |
| Gắn với đặt chỗ / giá / tour riêng | **Cùng database**: ẩn tour → ẩn lịch, kiểm tra ràng buộc dễ | Rời rạc: tour ở file, lịch ở DB | Rời rạc, thêm một nguồn dữ liệu |
| Song ngữ | Thiết kế theo ý mình (vi / en cạnh nhau) | Hai file riêng, dễ lệch | Có sẵn, cấu hình thêm |
| Chi phí tháng | ~0đ (Postgres sẵn có; ảnh dùng gói free) | 0đ | Free có giới hạn; lên gói trả phí ~$15–99/tháng |
| Phụ thuộc bên ngoài | Không | GitHub + dịch vụ CMS (Tina Cloud…) | Cao (dữ liệu nằm ở nhà cung cấp) |
| Công sức làm | **L** (~2 tuần) | **M** (~4–6 ngày) | **M–L** (~1–1,5 tuần) |
| Hợp với starter | Phần **kho ảnh** đưa vào starter được (dự án nào cũng cần) | Không | Không |

**Khuyến nghị: phương án A**, CMS ngay trong admin.
- Người vận hành không lập trình và cần sửa hằng ngày (giá, ảnh, mô tả). Hiệu lực tức thì và đăng nhập bằng tài khoản admin hiện có đơn giản hơn nhiều so với GitHub cộng chờ build.
- Tour, lịch khởi hành, booking, giá tour riêng nằm chung một database: ẩn tour, đổi giá, kiểm tra ràng buộc đều nhất quán.
- Không thêm phí tháng, không phụ thuộc dịch vụ ngoài.
- B rẻ hơn lúc làm, nhưng mỗi lần sửa phải chờ build, và marketing phải có tài khoản GitHub. Phù hợp khi người sửa là dev, không phù hợp ở đây.

## 4. Thiết kế phương án A

### 4.1 Dữ liệu
- Bảng `tours`: `slug` (URL, không đổi sau khi công khai), `destination`, `days`, `nights`, giá VND / USD, `private` (bảng giá tour riêng, JSON), `status` (nháp / công khai / ẩn), `featured`, `order`, ảnh (danh sách, ảnh đầu là bìa).
- Bảng `tour_translations` (một dòng mỗi ngôn ngữ): tên, tóm tắt, điểm khởi hành, quy mô nhóm, điểm nổi bật, lịch trình, bao gồm / không bao gồm, mô tả (Markdown), tiêu đề / mô tả SEO.
- Ràng buộc giữ nguyên như schema zod hiện tại (độ dài, số đêm ≤ số ngày, bậc giá tăng dần…): một bộ zod dùng cho cả form admin lẫn dữ liệu đọc ra.

### 4.2 Màn hình admin
1. **Danh sách tour**: tên, điểm đến, trạng thái (nháp / công khai / ẩn), giá, cờ "thiếu bản tiếng Anh", số ngày khởi hành sắp tới; nút "Tour mới", "Nhân bản".
2. **Sửa tour** (các tab):
   - *Thông tin chung*: điểm đến, số ngày / đêm, giá, nổi bật, thứ tự, trạng thái.
   - *Nội dung vi* / *Nội dung en*: các trường văn bản; lịch trình và danh sách dạng thêm / xoá / kéo thả dòng; mô tả bằng trình soạn thảo đơn giản (đậm, nghiêng, danh sách, link) lưu Markdown.
   - *Ảnh*: kéo thả upload, sắp xếp, chọn bìa, chữ thay thế (alt) vi / en.
   - *Tour riêng*: bảng bậc giá (số khách tối thiểu, giá VND / USD), số khách tối đa.
   - *SEO*: tiêu đề và mô tả hiển thị trên Google (có xem trước).
   - Nút **Xem trước** (trang tour như khách thấy, kể cả khi đang nháp) và **Lưu**.
3. Mọi thao tác ghi vào nhật ký admin (ai, lúc nào, tour nào).

### 4.3 Ảnh
- Kho ảnh công khai, có CDN: **Cloudflare R2** (free 10 GB, không tính phí băng thông) hoặc **Vercel Blob** (tích hợp sẵn, cần kiểm tra hạn mức của gói Pro).
- Upload thẳng từ trình duyệt bằng URL ký (như module storage của starter), giới hạn loại file (JPEG / PNG / WebP) và kích thước.
- Hiển thị qua `next/image` (tự sinh WebP / AVIF, đúng kích thước theo màn hình).
- Module storage hiện tại của starter làm cho **file riêng tư của người dùng** (link tải hết hạn nhanh), không hợp với ảnh công khai. Nên thêm vào starter một **thư viện ảnh công khai** (media library) dùng chung cho mọi dự án.

### 4.4 Tốc độ và SEO
- Trang tour vẫn render sẵn và cache. Khi lưu trong admin, chỉ trang liên quan được làm mới (`revalidatePath`): trang tour, danh sách tour, trang chủ, sitemap. Khách luôn nhận trang tĩnh nhanh.
- URL giữ nguyên (`/tours/<slug>`); không cho đổi slug khi tour đã công khai (hoặc tự tạo chuyển hướng 301).
- Tour nháp / ẩn không lên sitemap, trả 404 với khách.

### 4.5 Chuyển dữ liệu
- Script một lần: đọc 6 tour MDX (vi + en) → ghi vào DB, upload 9 ảnh lên kho ảnh. Chạy được nhiều lần không trùng.
- `getTourCatalog()` đổi sang đọc DB (có cache). 12 chỗ đang dùng gần như không phải sửa.
- Giữ file MDX một thời gian để đối chiếu, sau đó xoá.

### 4.6 Ngoài phạm vi đợt này (đề xuất làm sau)
- **Blog trong admin**: cùng cách làm (bảng bài viết + trình soạn thảo + ảnh). Nên làm ngay sau tour nếu marketing viết blog thường xuyên, vì blog là kênh SEO chính.
- Trang chủ / Giới thiệu / chính sách sửa trong admin: ít thay đổi, để sau.
- Phân quyền (marketing chỉ sửa nội dung, không thấy tiền): thuộc mục phân quyền nhân viên (H2).

## 5. Công việc và ước lượng

| # | Việc | Ước lượng |
|---|---|---|
| 1 | Schema `tours` + `tour_translations`, migration, zod dùng chung | 1 ngày |
| 2 | Script chuyển 6 tour MDX + ảnh; `getTourCatalog()` đọc DB + cache + làm mới khi lưu | 1,5 ngày |
| 3 | Kho ảnh công khai (đề xuất làm trong starter): upload ký URL, giới hạn, xoá | 2 ngày |
| 4 | Admin: danh sách tour, tạo / nhân bản / ẩn | 1 ngày |
| 5 | Admin: form sửa tour (các tab, danh sách kéo thả, trình soạn thảo Markdown, bảng giá tour riêng, SEO) | 3 ngày |
| 6 | Xem trước bản nháp, nhật ký, sitemap / 404 cho tour ẩn | 1 ngày |
| 7 | Test (unit, integration, E2E: tạo tour → công khai → đặt được), tài liệu hướng dẫn cho marketing | 1,5 ngày |
| | **Tổng** | **~11 ngày làm việc** |

## 6. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Sửa nhầm làm hỏng trang đang bán | Lưu nháp + xem trước; kiểm tra dữ liệu bằng zod trước khi lưu; nhật ký để biết ai sửa |
| Đổi slug làm mất SEO / link cũ | Khoá slug khi đã công khai (hoặc 301 tự động) |
| Ảnh quá nặng | Giới hạn kích thước upload; `next/image` tự tối ưu |
| Xoá tour đang có booking | Không cho xoá: chỉ "ẩn"; booking cũ vẫn hiển thị đúng tên tour |
| Hai người sửa cùng lúc | Cảnh báo khi bản đã bị người khác lưu sau lúc mở (so `updatedAt`) |

## 7. Câu hỏi cần chủ quyết định

1. **Phương án**: đồng ý A (CMS trong admin)?
2. **Kho ảnh**: Cloudflare R2 (free 10 GB, cần tạo tài khoản Cloudflare, có thể yêu cầu thẻ) hay Vercel Blob (cùng tài khoản Vercel, kiểm tra hạn mức gói Pro)?
3. **Blog**: làm luôn trong đợt này (thêm ~4 ngày) hay đợt sau?
4. **Nháp / duyệt**: marketing lưu là công khai luôn, hay cần chủ duyệt trước khi công khai?
