const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/**
 * Minimal, client-safe HTML version of a plain-text email (used when a message has no `html`).
 * Everything is escaped first; only http(s) URLs become links. Inline styles: email clients ignore <style>.
 */
export function textToHtml(text: string, options: { brand: string; accent?: string }): string {
  const accent = /^#[0-9a-f]{3,8}$/i.test(options.accent ?? "") ? options.accent! : "#2563eb";
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const html = escapeHtml(block)
        .replace(URL_PATTERN, (url) => `<a href="${url}" style="color:${accent};word-break:break-all">${url}</a>`)
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px">${html}</p>`;
    })
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#18181b"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px"><p style="margin:0 0 20px;font-weight:700;font-size:17px;color:${accent}">${escapeHtml(options.brand)}</p>${paragraphs}</div></body></html>`;
}
