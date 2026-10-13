import { csvResponse } from "@/app/_lib/csv";
import { requirePermission } from "@/app/_lib/staff";
import { getBookingAdminContent } from "@/product/booking/admin-content";

/** Passenger list of one departure as CSV (H1). Staff who may see bookings. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { container } = await requirePermission("bookings.view");
  const found = await container.app!.product.bookingAdmin.passengers(id);
  if (!found) return new Response("Not found", { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "vi";
  const c = getBookingAdminContent(locale).passengers;
  return csvResponse(
    `khach-${found.departure.tourSlug}-${found.departure.date}.csv`,
    Object.values(c.cols),
    found.rows.map((r, i) => [i + 1, r.missing ? `${r.name} (${c.missing(r.missing)})` : r.name, r.birthYear, r.kind ? c.kinds[r.kind] : "", r.code, r.contact, r.phone, r.note]),
  );
}
