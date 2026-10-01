"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Sends one page view per client-side navigation (path only; the server drops anything else). */
export function AnalyticsTracker({ endpoint = "/api/analytics/collect" }: { endpoint?: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const body = JSON.stringify({ path: pathname, referrer: document.referrer || null });
    // text/plain keeps sendBeacon a "simple" request; the route parses it as JSON.
    if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "text/plain" }))) {
      void fetch(endpoint, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
    }
  }, [pathname, endpoint]);
  return null;
}
