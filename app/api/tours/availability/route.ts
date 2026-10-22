import { NextResponse } from "next/server";
import { getContainer } from "@/bootstrap/container";
import { isCalendarDay } from "@/product/booking/rules";

/**
 * Group tours the guest can still book on a day for a party size (tour search with a date), for the static tour
 * list. Slugs only; CDN-cached for seconds like the departures route, and the hold always re-counts seats.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  const guests = Number(url.searchParams.get("guests") ?? "1");
  const { app, logger } = getContainer();
  if (!app || !isCalendarDay(date) || !Number.isInteger(guests) || guests < 1 || guests > 50) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const slugs = await app.product.booking.toursWithSeats(date, guests);
    return NextResponse.json({ slugs }, { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=30" } });
  } catch (error) {
    logger.error("tours.availability_failed", { error });
    return NextResponse.json({ slugs: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
