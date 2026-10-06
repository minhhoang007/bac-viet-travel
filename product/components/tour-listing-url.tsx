"use client";

import { useSearchParams } from "next/navigation";
import type { Locale } from "@/config/app";
import { parseTourFilters } from "../tours/filters";
import type { Destination, Tour } from "../tours/model";
import { TourListing } from "./tour-listing";

/**
 * The tour grid filtered by the URL in the browser, so the page itself stays static (edge-cached). The server
 * renders the unfiltered list as the Suspense fallback (no JavaScript: the form still reloads with the query).
 */
export function TourListingFromUrl(props: { locale: Locale; tours: Tour[]; destination?: Destination }) {
  const params = useSearchParams();
  return <TourListing {...props} filters={parseTourFilters(Object.fromEntries(params))} />;
}
