"use client";

import { CalendarDays } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { formatDay, formatVnd, getBookingContent } from "../booking/content";
import { getProductContent } from "../content";
import { parseTourFilters } from "../tours/filters";
import { formatPrice } from "../tours/format";

/** One departure as /api/tours/<slug>/departures returns it (live seats). */
export type PublicDeparture = { id: string; date: string; status: string; seatsLeft: number; unitPriceVnd: number; bookable: boolean };

type State = { departures: PublicDeparture[] | null; chosen?: PublicDeparture; bookHref: (departureId?: string) => string };
const TourBookingContext = createContext<State | null>(null);
const useTourBooking = () => useContext(TourBookingContext)!;

/**
 * Live part of a static tour page: departures and seats are fetched in the browser (never cached), and the date
 * and group size from the search (?date=&guests=) preselect a departure for the booking page.
 */
export function TourBookingProvider({ locale, slug, children }: { locale: Locale; slug: string; children: ReactNode }) {
  // Departures and the trip from the URL arrive together (one render once loaded).
  const [loaded, setLoaded] = useState<{ departures: PublicDeparture[]; trip: { date?: string; guests?: number } } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/tours/${encodeURIComponent(slug)}/departures`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { departures: [] }))
      .catch(() => ({ departures: [] }))
      .then((body: { departures: PublicDeparture[] }) => {
        const { date, guests } = parseTourFilters(Object.fromEntries(new URLSearchParams(window.location.search)));
        if (live) setLoaded({ departures: body.departures, trip: { date, guests } });
      });
    return () => {
      live = false;
    };
  }, [slug]);

  const departures = loaded?.departures ?? null;
  const trip = loaded?.trip ?? {};
  const chosen = trip.date ? departures?.find((d) => d.date === trip.date && d.bookable) : undefined;
  const bookHref = (departureId?: string) => {
    const q = new URLSearchParams();
    if (departureId) q.set("d", departureId);
    if (trip.guests) q.set("guests", String(trip.guests));
    const qs = q.toString();
    return `${localePath(locale, `/tours/${slug}/book`)}${qs ? `?${qs}` : ""}`;
  };
  return <TourBookingContext.Provider value={{ departures, chosen, bookHref }}>{children}</TourBookingContext.Provider>;
}

/** Upcoming departures with live seats (first 8), each linking to the booking page with that date. */
export function TourDepartureList({ locale, price }: { locale: Locale; price: { vnd: number; usd: number } }) {
  const { departures, chosen, bookHref } = useTourBooking();
  const c = getProductContent(locale);
  const b = getBookingContent(locale);
  if (!departures) {
    return (
      <p className="mt-4 min-h-40 rounded-2xl border border-border p-4 text-sm text-muted-foreground" role="status">
        {c.tours.departuresLoading}
      </p>
    );
  }
  const upcoming = departures.slice(0, 8);
  const seatLabel = (d: PublicDeparture) => (d.bookable ? b.seatsLeft(d.seatsLeft) : d.status === "closed" ? b.closed : d.seatsLeft <= 0 ? b.soldOut : b.tooSoon);
  return (
    <div data-loaded="">
      {upcoming.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{b.noDepartures}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {upcoming.map((d) => (
            <li key={d.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${chosen?.id === d.id ? "bg-primary/5" : ""}`} data-departure={d.date} aria-current={chosen?.id === d.id ? "true" : undefined}>
              <div className="flex items-center gap-3">
                <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium capitalize">{formatDay(d.date, locale)}</p>
                  <p className={`text-xs ${d.bookable && d.seatsLeft <= 5 ? "font-medium text-warning" : "text-muted-foreground"}`}>{seatLabel(d)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{locale === "vi" ? formatVnd(d.unitPriceVnd, locale) : formatPrice({ price: { vnd: d.unitPriceVnd, usd: Math.round((price.usd * d.unitPriceVnd) / price.vnd) } }, locale)}</span>
                {d.bookable ? (
                  <ButtonLink href={bookHref(d.id)} className="h-9 px-4" variant={chosen?.id === d.id ? "primary" : "outline"} aria-label={c.tours.chooseDay(formatDay(d.date, locale))}>
                    {b.choose}
                  </ButtonLink>
                ) : (
                  <span className="w-16 text-center text-xs text-muted-foreground">—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {departures.length > upcoming.length && (
        <a href={bookHref(chosen?.id)} className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4">
          {c.tours.departuresAll} →
        </a>
      )}
    </div>
  );
}

/** Book button of the side panel ("book on <date>" once a searched date is bookable) and of the phone bar. */
export function TourBookButton({ locale, place, className }: { locale: Locale; place: "aside" | "mobile"; className?: string }) {
  const { chosen, bookHref } = useTourBooking();
  const c = getProductContent(locale);
  if (place === "mobile") {
    return (
      <ButtonLink href={bookHref(chosen?.id)} data-testid="mobile-book" className={className}>
        {c.tours.chooseDate}
      </ButtonLink>
    );
  }
  return (
    <ButtonLink href={bookHref(chosen?.id)} className={className} data-testid="book-online">
      {chosen ? c.tours.bookDate(formatDay(chosen.date, locale)) : c.tours.chooseDate}
    </ButtonLink>
  );
}
