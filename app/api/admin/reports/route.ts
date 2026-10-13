import { csvResponse } from "@/app/_lib/csv";
import { requirePermission } from "@/app/_lib/staff";
import { getTours } from "@/app/_lib/tours";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { monthRange } from "@/product/booking/reports";
import { vietnamToday } from "@/product/booking/rules";

/** Report tables as CSV for the accountant: ?kind=cash|receivables|tours&from=YYYY-MM&to=YYYY-MM. Staff with reports. */
export async function GET(request: Request) {
  const { container } = await requirePermission("reports");
  const reports = container.app!.product.reports;
  const q = new URL(request.url).searchParams;
  const locale = q.get("locale") === "en" ? "en" : "vi";
  const t = getBookingAdminContent(locale).reports;
  const today = vietnamToday(new Date());
  const range = monthRange({ from: q.get("from") ?? undefined, to: q.get("to") ?? undefined }, today);
  const tours = (await getTours()).list(locale);
  const title = (slug: string) => tours.find((x) => x.slug === slug)?.title ?? slug;

  switch (q.get("kind")) {
    case "cash": {
      const cash = await reports.cash(range.from, range.to);
      return csvResponse(`thu-tien-${range.fromMonth}_${range.toMonth}.csv`, t.cashCols, [
        ...cash.byChannel.map((r) => [t.channels[r.channel], r.depositsVnd, r.balancesVnd, r.depositsVnd + r.balancesVnd]),
        [t.cashTotal, "", "", cash.collectedVnd],
        [t.refunded, "", "", -cash.refundedVnd],
        [t.net, "", "", cash.collectedVnd - cash.refundedVnd],
      ]);
    }
    case "receivables": {
      const rows = await reports.receivables(today);
      return csvResponse(`khach-con-no-${today}.csv`, t.receivablesCols, rows.map((r) => [r.date, r.code, r.name, r.phone, title(r.tourSlug), r.dueVnd]));
    }
    case "tours": {
      const report = await reports.report(range.from, range.to);
      return csvResponse(`ban-theo-tour-${range.fromMonth}_${range.toMonth}.csv`, t.cols, report.tours.map((r) => [title(r.tourSlug), r.departures, `${r.seats}/${r.capacity}`, r.capacity ? `${Math.round((r.seats / r.capacity) * 100)}%` : "", r.bookings, r.revenueVnd, r.depositsVnd]));
    }
    default:
      return new Response("Not found", { status: 404 });
  }
}
