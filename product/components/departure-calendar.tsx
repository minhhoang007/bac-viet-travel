"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import type { Locale } from "@/config/app";
import { formatDay, getBookingContent } from "../booking/content";
import { getProductContent } from "../content";

type Day = { id: string; date: string; seatsLeft: number; bookable: boolean; price: string };

/** Short price for a small cell: 2.390.000 ₫ → 2,39tr; $95 stays. */
const shortPrice = (price: string, locale: Locale) => (locale === "vi" ? price.replace(/\s?₫$/, "").replace(/^(\d+)\.(\d{2})\d?\.\d{3}$/, "$1,$2tr") : price);

/**
 * Month view of the departures (C3): a Monday-first grid per month with seats and price on each departure day;
 * bookable days link to the booking page. Months without departures are skipped by the arrows.
 */
export function DepartureCalendar({ locale, days, bookHref, chosenId }: { locale: Locale; days: Day[]; bookHref: (id: string) => string; chosenId?: string }) {
  const c = getProductContent(locale).tours;
  const b = getBookingContent(locale);
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();
  const chosenMonth = days.find((d) => d.id === chosenId)?.date.slice(0, 7);
  const [index, setIndex] = useState(Math.max(0, chosenMonth ? months.indexOf(chosenMonth) : 0));
  const month = months[index];
  if (!month) return null;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const title = first.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  // 2024-01-01 is a Monday: weekday names in the page language.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { weekday: "short", timeZone: "UTC" }));

  return (
    <div className="mt-4 border border-border p-3" data-testid="departure-calendar">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label={c.calendarPrev} className="grid size-9 place-items-center rounded-md hover:bg-muted disabled:opacity-40">
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <p className="font-semibold capitalize" aria-live="polite" data-testid="calendar-month">
          {title}
        </p>
        <button type="button" onClick={() => setIndex(index + 1)} disabled={index === months.length - 1} aria-label={c.calendarNext} className="grid size-9 place-items-center rounded-md hover:bg-muted disabled:opacity-40">
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <table className="w-full table-fixed text-center text-xs">
        <caption className="sr-only">{c.calendarCaption(title)}</caption>
        <thead>
          <tr>
            {weekdays.map((w) => (
              <th key={w} scope="col" className="pb-1 font-medium text-muted-foreground">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((date, i) => {
                const d = date ? byDate.get(date) : undefined;
                const label = date ? Number(date.slice(8)) : "";
                const body = (
                  <>
                    <span className="block text-sm font-medium">{label}</span>
                    {d && <span className="block truncate text-[11px] tracking-tight sm:text-xs">{d.bookable ? shortPrice(d.price, locale) : "—"}</span>}
                    {d && <span className={cn("block truncate", d.bookable && d.seatsLeft <= 5 ? "font-medium text-warning" : "text-muted-foreground")}>{d.bookable ? d.seatsLeft : ""}</span>}
                  </>
                );
                return (
                  <td key={date ?? `e${i}`} className="p-0.5" data-calendar-day={d ? date : undefined}>
                    {d?.bookable ? (
                      <a
                        href={bookHref(d.id)}
                        aria-label={`${c.chooseDay(formatDay(d.date, locale))} · ${b.seatsLeft(d.seatsLeft)} · ${d.price}`}
                        className={cn("block rounded-md border p-1 hover:border-primary", d.id === chosenId ? "border-primary bg-primary/10" : "border-border")}
                        aria-current={d.id === chosenId ? "true" : undefined}
                      >
                        {body}
                      </a>
                    ) : (
                      <div className={cn("rounded-md p-1", d ? "bg-muted text-muted-foreground" : "text-muted-foreground/60")}>{body}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">{c.calendarLegend}</p>
    </div>
  );
}
