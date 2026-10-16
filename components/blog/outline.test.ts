import { describe, expect, it } from "vitest";
import { faq, headingSlug, outline } from "./outline";

const post = `Mở bài.

## Thời điểm **đẹp** nhất
Tháng 4–6.

### Mùa hè
Nóng.

\`\`\`
## not a heading
\`\`\`

## Chi phí & [di chuyển](/tours)
## Chi phí & di chuyển

## Câu hỏi thường gặp

### Đi Hạ Long mấy ngày là đủ?
Hai ngày một đêm, **ngủ trên du thuyền**.

### Có cần đặt trước không?
Nên đặt trước 2 tuần.

## Lời kết
`;

describe("blog outline", () => {
  it("slugs fold Vietnamese marks and đ", () => {
    expect(headingSlug("Đi Hạ Long mấy ngày?")).toBe("di-ha-long-may-ngay");
    expect(headingSlug("!!!")).toBe("muc");
  });

  it("lists ## and ### outside code, plain text, unique ids", () => {
    expect(outline(post).map((h) => [h.level, h.text, h.id])).toEqual([
      [2, "Thời điểm đẹp nhất", "thoi-diem-dep-nhat"],
      [3, "Mùa hè", "mua-he"],
      [2, "Chi phí & di chuyển", "chi-phi-di-chuyen"],
      [2, "Chi phí & di chuyển", "chi-phi-di-chuyen-2"],
      [2, "Câu hỏi thường gặp", "cau-hoi-thuong-gap"],
      [3, "Đi Hạ Long mấy ngày là đủ?", "di-ha-long-may-ngay-la-du"],
      [3, "Có cần đặt trước không?", "co-can-dat-truoc-khong"],
      [2, "Lời kết", "loi-ket"],
    ]);
  });

  it("reads the FAQ section's questions and answers, up to the next ## section", () => {
    expect(faq(post)).toEqual([
      { question: "Đi Hạ Long mấy ngày là đủ?", answer: "Hai ngày một đêm, ngủ trên du thuyền." },
      { question: "Có cần đặt trước không?", answer: "Nên đặt trước 2 tuần." },
    ]);
    expect(faq("## Khác\n### Hỏi?\nĐáp.")).toEqual([]);
  });
});
