"use client";

import { CalendarDays } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { formatDay, getBookingContent } from "../booking/content";
import { getProductContent } from "../content";
import { parseTourFilters } from "../tours/filters";
import { formatAmount } from "../tours/format";
import { DepartureCalendar } from "./departure-calendar";

/** One departure as /api/tours/<slug>/departures returns it (live seats). */
export type PublicDeparture = { id: string; date: string; status: string; seatsLeft: number; unitPriceVnd: number; bookable: boolean };

type State = { departures: PublicDeparture[] | null; failed: boolean; retry: () => void; chosen?: PublicDeparture; bookHref: (departureId?: string) => string };
const TourBookingContext = createContext<State | null>(null);
const useTourBooking = () => useContext(TourBookingContext)!;

/**
 * Live part of a static tour page: departures and seats are fetched in the browser (never cached), and the date
 * and group size from the search (?date=&guests=) preselect a departure for the booking page.
 */
export function TourBookingProvider({ locale, slug, live = true, children }: { locale: Locale; slug: string; live?: boolean; children: ReactNode }) {
  // Departures and the trip from the URL arrive together (one render once loaded). failed: the request failed (not
  // "no departures"), so the page offers a retry instead of saying the tour has no dates.
  const [loaded, setLoaded] = useState<{ departures: PublicDeparture[] | null; failed: boolean; trip: { date?: string; guests?: number } } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!live) return; // staff preview: no departures shown
    let current = true;
    fetch(`/api/tours/${encodeURIComponent(slug)}/departures`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { departures: PublicDeparture[] }).departures : null))
      .catch(() => null)
      .then((departures) => {
        const { date, guests } = parseTourFilters(Object.fromEntries(new URLSearchParams(window.location.search)));
        if (current) setLoaded({ departures, failed: departures === null, trip: { date, guests } });
      });
    return () => {
      current = false;
    };
  }, [slug, live, attempt]);

  const departures = loaded?.departures ?? null;
  const failed = loaded?.failed ?? false;
  const retry = () => {
    setLoaded(null);
    setAttempt((n) => n + 1);
  };
  const trip = loaded?.trip ?? {};
  const chosen = trip.date ? departures?.find((d) => d.date === trip.date && d.bookable) : undefined;
  const bookHref = (departureId?: string) => {
    const q = new URLSearchParams();
    if (departureId) q.set("d", departureId);
    if (trip.guests) q.set("guests", String(trip.guests));
    const qs = q.toString();
    return `${localePath(locale, `/tours/${slug}/book`)}${qs ? `?${qs}` : ""}`;
  };
  return <TourBookingContext.Provider value={{ departures, failed, retry, chosen, bookHref }}>{children}</TourBookingContext.Provider>;
}

/** Upcoming departures with live seats (first 8), each linking to the booking page with that date. */
export function TourDepartureList({ locale, price }: { locale: Locale; price: { vnd: number; usd: number } }) {
  const { departures, failed, retry, chosen, bookHref } = useTourBooking();
  const [view, setView] = useState<"list" | "month">("list");
  const c = getProductContent(locale);
  const b = getBookingContent(locale);
  if (failed) {
    return (
      <div className="mt-4 border border-warning/40 bg-warning/10 p-4 text-sm" role="alert" data-testid="departures-failed">
        <p>{c.tours.departuresFailed}</p>
        <button type="button" onClick={retry} className="mt-2 font-medium text-primary underline underline-offset-4">
          {c.tours.departuresRetry}
        </button>
      </div>
    );
  }
  if (!departures) {
    return (
      <p className="mt-4 min-h-40 border border-border p-4 text-sm text-muted-foreground" role="status">
        {c.tours.departuresLoading}
      </p>
    );
  }
  const upcoming = departures.slice(0, 8);
  const seatLabel = (d: PublicDeparture) => (d.bookable ? b.seatsLeft(d.seatsLeft) : d.status === "closed" ? b.closed : d.seatsLeft <= 0 ? b.soldOut : b.tooSoon);
  const money = (vnd: number) => formatAmount(vnd, price, locale);
  const toggle = (value: "list" | "month", label: string) => (
    <button type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-md px-3 py-1 text-sm ${view === value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
      {label}
    </button>
  );
  return (
    <div data-loaded="">
      {departures.length > 0 && (
        <div className="mt-4 inline-flex gap-1 rounded-lg border border-border p-1" role="group" aria-label={c.tours.departuresView}>
          {toggle("list", c.tours.viewList)}
          {toggle("month", c.tours.viewMonth)}
        </div>
      )}
      {view === "month" && departures.length > 0 ? (
        <DepartureCalendar locale={locale} days={departures.map((d) => ({ id: d.id, date: d.date, seatsLeft: d.seatsLeft, bookable: d.bookable, price: money(d.unitPriceVnd) }))} bookHref={bookHref} chosenId={chosen?.id} />
      ) : upcoming.length === 0 ? (
        <p className="mt-4 border border-dashed border-border p-4 text-sm text-muted-foreground">{b.noDepartures}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border border-border">
          {upcoming.map((d) => (
            <li key={d.id} className={`flex items-center justify-between gap-3 px-3 py-3 sm:px-4 ${chosen?.id === d.id ? "bg-primary/5" : ""}`} data-departure={d.date} aria-current={chosen?.id === d.id ? "true" : undefined}>
              <div className="flex min-w-0 items-center gap-3">
                <CalendarDays aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize sm:text-base">{formatDay(d.date, locale)}</p>
                  <p className={`text-xs ${d.bookable && d.seatsLeft <= 5 ? "font-medium text-warning" : "text-muted-foreground"}`}>{seatLabel(d)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="text-sm font-semibold tabular-nums">{money(d.unitPriceVnd)}</span>
                {d.bookable ? (
                  <ButtonLink href={bookHref(d.id)} className="h-9 px-3 sm:px-4" variant={chosen?.id === d.id ? "primary" : "outline"} aria-label={c.tours.chooseDay(formatDay(d.date, locale))}>
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
      {view === "list" && departures.length > upcoming.length && (
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
