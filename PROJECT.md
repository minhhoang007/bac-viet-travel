# Bắc Việt Travel (demo)

Website công ty du lịch: tour Hạ Long, Ninh Bình, Sapa khởi hành từ Hà Nội. Dựng từ Minh Starter `v1.0.0-rc.6`
(profile `site`, modules `email`, `blog`).

## Phần riêng của dự án
| Đường dẫn | Nội dung |
|---|---|
| `content/tours/<vi\|en>/<slug>.mdx` | Danh mục tour (frontmatter kiểm tra bằng zod; cùng slug cho vi/en) |
| `product/tours/` | Đọc danh mục, form yêu cầu đặt tour (email cho đội + email xác nhận cho khách), nguồn ảnh |
| `product/components/` | Thẻ tour, form đặt tour, nút liên hệ nhanh (Zalo / WhatsApp / hotline) |
| `product/home.tsx`, `product/layout.tsx` | Các khối trang chủ, dòng giấy phép + nút liên hệ trên mọi trang |
| `config/contact.ts` | **Số Zalo, WhatsApp, hotline, email, giấy phép: đang là số demo, phải thay** |
| `app/[locale]/tours`, `app/[locale]/credits` | Trang tour, trang nguồn ảnh |
| `public/tours/` | Ảnh Unsplash (Unsplash License), ghi nguồn tại `/credits` |

## Trước khi chạy thật
- Thay toàn bộ thông tin trong `config/contact.ts` và tên công ty.
- Giá tour trong `content/tours/` là giá tham khảo cho demo.
- Thay đánh giá mẫu trong `product/content.ts` bằng đánh giá thật.
- Sửa `content/legal.ts` (điều khoản đặt tour, chính sách huỷ, bảo mật).
- Env: `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SITE_URL`.

## Nâng cấp starter
`git fetch starter --tags && git merge v1.0.0-rc.N` (xem docs/UPGRADING.md).
