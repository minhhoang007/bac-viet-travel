# Viết bài blog

Bật module: `blog: true` trong `config/features.ts` (hoặc `pnpm init:project --modules blog`).
Header tự có link **Blog**. Thiết kế: [ADR-0007](adr/0007-blog-mdx.md).

## Thêm bài
1. Tạo file `content/blog/vi/<slug>.mdx`. Tên file là đường dẫn: `kinh-nghiem-ha-long.mdx` → `/blog/kinh-nghiem-ha-long`.
   Chỉ dùng chữ thường không dấu, số và dấu `-`.
2. Đầu file là frontmatter:

```mdx
---
title: "Kinh nghiệm du lịch Hạ Long"
description: "Mô tả ngắn, hiện trên Google và mạng xã hội (≤ 300 ký tự)."
date: "2026-10-01"
updated: "2026-10-15"          # tuỳ chọn
tags: ["ha-long", "kinh-nghiem"] # chữ thường-có-gạch
cover: "/blog/ha-long.jpg"      # ảnh trong public/, dùng cho Open Graph
author: "Minh"                  # mặc định: config/blog.ts
translationKey: "ha-long-tips"  # cùng key với bản tiếng Anh
draft: true                     # chỉ hiện khi chạy pnpm dev
---

Nội dung Markdown…
```

3. `pnpm dev` để xem. Frontmatter sai → `pnpm build` báo lỗi kèm tên file và trường sai.

## Bản tiếng Anh
Tạo `content/blog/en/<slug-tieng-anh>.mdx` với **cùng `translationKey`**. Hai bài tự liên kết (hreflang, link "Read in…").

## Trong nội dung
- Markdown đầy đủ + bảng, checklist (GFM).
- Hộp ghi chú: `<Callout>…</Callout>`, `<Callout tone="warning">…</Callout>`.
- Ảnh tối ưu: `<Figure src="/blog/a.jpg" alt="…" width={1200} height={630} caption="…" />` (ảnh Markdown `![]()` cũng được, nhưng không tối ưu).
- Link ra ngoài tự mở tab mới với `rel="noopener noreferrer"`.

## Viết bài trong trang quản trị (không cần sửa code)
Đặt `source: "content"` trong `config/blog.ts` và bật `content` trong `config/features.ts`:
- Biên tập viên viết bài ở **/admin/posts**: tiêu đề, đường dẫn, mô tả, ngày, thẻ, ảnh bìa, nội dung Markdown.
- Quy trình duyệt như mọi nội dung: gửi duyệt → admin duyệt ngay, hẹn giờ hoặc trả lại; có xem trước, lịch sử phiên
  bản, đổi đường dẫn thì link cũ tự chuyển.
- Nội dung là Markdown thường cộng `<Callout>`; không chạy code (an toàn với mọi thứ biên tập viên gõ).
- Chuyển các bài .mdx đang có vào: `pnpm blog:import --as <email admin>` (chạy thử), rồi thêm `--apply`.

## Cấu hình
`config/blog.ts`: số bài mỗi trang, tác giả mặc định, tốc độ đọc.

## SEO có sẵn
Title/description, canonical, Open Graph `article`, JSON-LD `BlogPosting`, hreflang, `sitemap.xml`, RSS (`/blog/rss.xml`, `/en/blog/rss.xml`).

> ⚠️ Chỉ đưa vào MDX nội dung do đội dự án viết. Không bao giờ render nội dung người dùng gửi lên bằng MDX (MDX chạy được code).
