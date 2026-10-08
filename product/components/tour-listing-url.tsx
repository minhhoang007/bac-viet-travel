"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/config/app";
import type { Destination } from "../tours/destinations";
import { parseTourFilters } from "../tours/filters";
import type { Tour } from "../tours/model";
import { TourListing } from "./tour-listing";

type Props = { locale: Locale; tours: Tour[]; destination?: Destination };

function FromSearchParams(props: Props) {
  const search = useSearchParams();
  // Remount on a filtered URL so the form's default values follow it.
  return <TourListing key={search.toString()} {...props} filters={parseTourFilters(Object.fromEntries(search))} />;
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
