"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/config/app";
import type { Destination } from "../tours/destinations";
import { parseTourFilters } from "../tours/filters";
import type { Tour } from "../tours/model";
import { TourListing } from "./tour-listing";

type Props = { locale: Locale; tours: Tour[]; destination?: Destination };

function FromSearchParams(props: Props) {
  const search = useSearchParams();
  const filters = parseTourFilters(Object.fromEntries(search));
  const available = useAvailability(filters.date, filters.guests ?? 1);
  // Remount on a filtered URL so the form's default values follow it.
  return <TourListing key={search.toString()} {...props} filters={filters} available={available} />;
}

/** Group tours with seats on the searched day (null until known, or when it cannot be loaded: no marks then). */
function useAvailability(date: string | undefined, guests: number) {
  const [result, setResult] = useState<{ key: string; slugs: Set<string> } | null>(null);
  const key = date ? `${date}:${guests}` : "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/tours/availability?date=${encodeURIComponent(date!)}&guests=${guests}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { slugs?: string[] } | null) => {
        if (live && body?.slugs) setResult({ key, slugs: new Set(body.slugs) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, date, guests]);
  return result?.key === key ? result.slugs : null;
}

/**
 * The tour grid filtered by the URL in the browser, so the page itself stays static (edge-cached). The static HTML
 * is the unfiltered list (the Suspense fallback); the query string applies right after, and again on every in-place
 * navigation (filter form, reset link, header links). Without JavaScript the form still submits but the list stays
 * unfiltered.
 */
export function TourListingFromUrl(props: Props) {
  return (
    <Suspense fallback={<TourListing {...props} filters={parseTourFilters({})} />}>
      <FromSearchParams {...props} />
    </Suspense>
  );
}
