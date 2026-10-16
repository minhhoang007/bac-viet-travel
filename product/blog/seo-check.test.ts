import { describe, expect, it } from "vitest";
import { seoChecks } from "./seo-check";

const by = (checks: ReturnType<typeof seoChecks>) => Object.fromEntries(checks.map((c) => [c.key, c]));

describe("seoChecks", () => {
  it("flags what a thin draft is missing", () => {
    const c = by(seoChecks({ title: "Hạ Long", description: "Ngắn.", cover: "", body: "## Một\n\n![](/a.jpg)\n\nVài chữ." }));
    expect(c.title).toMatchObject({ ok: false, value: 7 });
    expect(c.description!.ok).toBe(false);
    expect(c.cover!.ok).toBe(false);
    expect(c.sections).toMatchObject({ ok: false, value: 1 });
    expect(c.length!.ok).toBe(false);
    expect(c.alt).toMatchObject({ ok: false, value: 1 });
    expect(c.tour!.ok).toBe(false);
  });

  it("passes a complete guide", () => {
    const body = ["## Khi nào đi", "## Đi thế nào", "## Ăn gì"].map((h) => `${h}\n\n${"chữ ".repeat(210)}`).join("\n\n") + '\n\n![Vịnh lúc bình minh](/a.jpg)\n\n<Tour slug="ha-long-cruise-2d1n" />';
    const checks = seoChecks({ title: "Kinh nghiệm du lịch Hạ Long tự túc 2026", description: "Đi Hạ Long tháng nào đẹp, ngủ du thuyền hay khách sạn, chi phí bao nhiêu: mọi điều cần biết.", cover: "/c.jpg", body });
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("counts a Markdown link to a tour page as leading somewhere", () => {
    expect(by(seoChecks({ title: "", description: "", cover: "", body: "Xem [tour](/en/tours/sapa-trekking-2d1n)." })).tour!.ok).toBe(true);
  });
});
