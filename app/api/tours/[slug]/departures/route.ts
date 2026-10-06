import { NextResponse } from "next/server";
import { getContainer } from "@/bootstrap/container";
import type { PublicDeparture } from "@/product/components/tour-departures";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Upcoming departures of a tour with seats, for the static tour page (CDN-cached for seconds). Public fields only. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { app, logger } = getContainer();
  if (!app || !SLUG.test(slug) || slug.length > 120) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const departures: PublicDeparture[] = (await app.product.booking.listDepartures(slug)).map((d) => ({
      id: d.id,
      date: d.date,
      status: d.status,
      seatsLeft: d.seatsLeft,
      unitPriceVnd: d.unitPriceVnd,
      bookable: d.bookable,
    }));
    // A few seconds at the CDN (Vercel): a burst of visitors or bots costs one query, seats stay near-live, and the
    // booking page and the hold always re-count seats.
    return NextResponse.json({ departures }, { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=30" } });
  } catch (error) {
    logger.error("tours.departures_failed", { slug, error });
    return NextResponse.json({ departures: [] }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
