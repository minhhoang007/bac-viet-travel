"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/config/app";
import type { Destination } from "../tours/destinations";
import { parseTourFilters } from "../tours/filters";
import type { Tour } from "../tours/model";
import { TourListing } from "./tour-listing";

const noSubscribe = () => () => {};

/**
 * The tour grid filtered by the URL in the browser, so the page itself stays static (edge-cached). The static HTML
 * is the unfiltered list (the same markup on hydration, no re-render of the images); a query string applies right
 * after. Without JavaScript the form still submits but the list stays unfiltered.
 */
export function TourListingFromUrl(props: { locale: Locale; tours: Tour[]; destination?: Destination }) {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  // Remount on a filtered URL so the form's default values follow it.
  return <TourListing key={search} {...props} filters={parseTourFilters(Object.fromEntries(new URLSearchParams(search)))} />;
}
