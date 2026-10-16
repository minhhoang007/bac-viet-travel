import { describe, expect, it } from "vitest";
import { imageMarkdown } from "./markdown-editor";

describe("imageMarkdown", () => {
  it("a library photo: just the image with its description", () => {
    expect(imageMarkdown({ src: "https://res.cloudinary.com/x/a.jpg", alt: "Vịnh Hạ Long" }, "Ảnh:")).toBe("\n\n![Vịnh Hạ Long](https://res.cloudinary.com/x/a.jpg)\n\n");
  });

  it("an Unsplash photo: a caption line credits the photographer and Unsplash, with UTM links", () => {
    const md = imageMarkdown({ src: "https://images.unsplash.com/photo-1?w=1600", alt: "rice [terraces]", credit: { name: "Duc [N]", url: "https://unsplash.com/@duc?utm_source=bac_viet_travel&utm_medium=referral" } }, "Ảnh:");
    expect(md).toContain("![rice terraces](https://images.unsplash.com/photo-1?w=1600)");
    // Brackets in text are dropped so they cannot break the Markdown link syntax.
    expect(md).toContain("*Ảnh: [Duc N](https://unsplash.com/@duc?utm_source=bac_viet_travel&utm_medium=referral) / [Unsplash](https://unsplash.com/?utm_source=bac_viet_travel&utm_medium=referral)*");
  });
});
