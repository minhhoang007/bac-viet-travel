/** CSV cell: quoted, quotes doubled; a leading = + - @ is neutralised (spreadsheet formula injection). */
const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** A CSV download, UTF-8 with BOM so Excel shows Vietnamese correctly; never cached. */
export function csvResponse(filename: string, header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): Response {
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" },
  });
}
