import { describe, expect, it } from "vitest";
import { withUpdated } from "..";

const live = { title: "Hạ Long", description: "Cẩm nang", body: "Đi tháng 4.", date: "2026-03-01" };

describe("withUpdated", () => {
  it("dates a live post's changed words today", () => {
    expect(withUpdated({ ...live, body: "Đi tháng 4–6." }, live, "2026-10-16").updated).toBe("2026-10-16");
    expect(withUpdated({ ...live, title: "Hạ Long 2026", updated: "2026-05-01" }, live, "2026-10-16").updated).toBe("2026-10-16");
  });

  it("leaves drafts never published, unchanged words (tags, cover…) and a date already today or later", () => {
    expect(withUpdated({ ...live, body: "Mới." }, null, "2026-10-16").updated).toBeUndefined();
    expect(withUpdated({ ...live, tags: ["ha-long"] }, live, "2026-10-16").updated).toBeUndefined();
    expect(withUpdated({ ...live, body: "Mới.", updated: "2026-10-16" }, live, "2026-10-16").updated).toBe("2026-10-16");
  });
});
