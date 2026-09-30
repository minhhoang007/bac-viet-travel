/**
 * Serializes structured data for `<script type="application/ld+json">`.
 * Escapes characters that could close the script element or break parsing, so user/CMS text is safe.
 */
export function serializeJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
