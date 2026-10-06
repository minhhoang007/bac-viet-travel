import { NextResponse } from "next/server";
import { getContainer } from "@/bootstrap/container";
import type { PublicDeparture } from "@/product/components/tour-departures";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Upcoming departures of a tour with live seats, for the static tour page (never cached). Public fields only. */
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
    return NextResponse.json({ departures }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("tours.departures_failed", { slug, error });
    return NextResponse.json({ departures: [] }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
