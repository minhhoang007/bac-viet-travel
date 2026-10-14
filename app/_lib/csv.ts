/**
 * CSV cell: quoted, quotes doubled; text with a leading = + - @ is neutralised (spreadsheet formula injection).
 * Numbers are ours, not typed by a guest: a refund stays -300000, a number the spreadsheet can add up.
 */
const cell = (v: string | number | null) => {
  if (typeof v === "number") return `"${v}"`;
  const s = v === null ? "" : v;
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** A CSV download, UTF-8 with BOM so Excel shows Vietnamese correctly; never cached. */
export function csvResponse(filename: string, header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): Response {
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" },
  });
}
