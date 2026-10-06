import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown";

const html = async (source: string) => renderToStaticMarkup(await MarkdownContent({ source }));

describe("MarkdownContent (staff text from the database)", () => {
  it("renders Markdown and GFM", async () => {
    const out = await html("## Ngày 1\n\n**Đón khách** lúc 7:30\n\n- kayak\n- hang Luồn\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(out).toContain("<h2>Ngày 1</h2>");
    expect(out).toContain("<strong>Đón khách</strong>");
    expect(out).toContain("<li>kayak</li>");
    expect(out).toContain("<table>");
  });

  it("never evaluates expressions, JSX or ESM", async () => {
    process.env.MARKDOWN_TEST_SECRET = "s3cret-value";
    const out = await html("Giá {process.env.MARKDOWN_TEST_SECRET} {(() => { throw new Error('ran') })()}\n\nexport const x = 1\n\n<Evil />");
    expect(out).not.toContain("s3cret-value");
    expect(out).toContain("{process.env.MARKDOWN_TEST_SECRET}");
  });

  it("drops raw HTML and unsafe URLs", async () => {
    const out = await html('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[a](javascript:alert(1)) [b](//evil.example) [c](/tours) [d](https://example.com)\n\n![x](javascript:alert(1))');
    expect(out).not.toMatch(/<script|onerror|javascript:|evil\.example/);
    expect(out).toContain('href="/tours"');
    expect(out).toContain('href="https://example.com"');
  });

  it("keeps <Callout> blocks, with Markdown inside", async () => {
    const out = await html('Trước\n\n<Callout tone="warning">Mang **áo ấm**</Callout>\n\nSau <Callout>Ghi chú</Callout>');
    expect(out).toContain("Trước");
    expect(out).toContain("<strong>áo ấm</strong>");
    expect(out.match(/<aside/g)).toHaveLength(2);
    expect(out).toContain("border-warning");
  });
});
