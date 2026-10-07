import { requireAdmin } from "@/app/_lib/admin";
import { getBookingAdminContent } from "@/product/booking/admin-content";

/** CSV cell: quoted, quotes doubled; a leading = + - @ is neutralised (spreadsheet formula injection). */
const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Passenger list of one departure as CSV (H1), UTF-8 with BOM so Excel shows Vietnamese correctly. Admins only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { container } = await requireAdmin();
  const found = await container.app!.product.bookingAdmin.passengers(id);
  if (!found) return new Response("Not found", { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "vi";
  const c = getBookingAdminContent(locale).passengers;
  const lines = [
    Object.values(c.cols).map(cell).join(","),
    ...found.rows.map((r, i) =>
      [i + 1, r.missing ? `${r.name} (${c.missing(r.missing)})` : r.name, r.birthYear, r.kind ? c.kinds[r.kind] : "", r.code, r.contact, r.phone, r.note].map(cell).join(","),
    ),
  ];
  const name = `khach-${found.departure.tourSlug}-${found.departure.date}.csv`;
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" },
  });
}
