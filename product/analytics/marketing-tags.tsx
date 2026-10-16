"use client";

// Ad and conversion tags (GA4, Meta Pixel) for the tour company's campaigns. Loaded only after the visitor accepts
// cookies in the starter's consent banner (analytics module), and only when an ID is configured.
import { useEffect } from "react";
import { CONSENT_COOKIE } from "@/components/analytics/consent";

export interface MarketingIds {
  ga4?: string;
  metaPixel?: string;
}

/** Funnel steps, named after the GA4 recommended events; Meta gets its standard event for each. */
export type FunnelEvent = "view_item" | "begin_checkout" | "generate_lead" | "purchase";
const META_EVENT: Record<FunnelEvent, string> = { view_item: "ViewContent", begin_checkout: "InitiateCheckout", generate_lead: "Lead", purchase: "Purchase" };

type TagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] } };

const granted = () => document.cookie.split(/;\s*/).includes(`${CONSENT_COOKIE}=granted`);

function loadScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function start(ids: MarketingIds) {
  const w = window as TagWindow;
  if (ids.ga4 && !w.gtag) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function gtag() {
      // gtag.js reads the `arguments` object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("config", ids.ga4);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4)}`);
  }
  if (ids.metaPixel && !w.fbq) {
    const fbq = ((...args: unknown[]) => fbq.queue!.push(args)) as NonNullable<TagWindow["fbq"]>;
    fbq.queue = [];
    w.fbq = fbq;
    fbq("init", ids.metaPixel);
    fbq("track", "PageView");
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
  }
}

/** On every page: starts the tags once consent is granted (now, or later from the banner). */
export function MarketingTags({ ids }: { ids: MarketingIds }) {
  useEffect(() => {
    if (!ids.ga4 && !ids.metaPixel) return;
    if (granted()) return start(ids);
    // The banner sets the cookie without an event: check again on the next clicks until the choice is made.
    const check = () => {
      if (granted()) {
        start(ids);
        document.removeEventListener("click", check);
      }
    };
    document.addEventListener("click", check);
    return () => document.removeEventListener("click", check);
  }, [ids]);
  return null;
}

/** Sends one funnel event to whichever tag is running. `once`: a key so a reload does not count it twice. */
export function TrackEvent({ name, valueVnd, item, once }: { name: FunnelEvent; valueVnd?: number; item?: string; once?: string }) {
  useEffect(() => {
    if (!granted()) return;
    if (once) {
      const key = `tracked:${name}:${once}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        // Storage blocked: send it anyway.
      }
    }
    // The tags start on the same render pass: wait one tick so gtag/fbq exist.
    const id = setTimeout(() => {
      const w = window as TagWindow;
      const value = valueVnd === undefined ? {} : { value: valueVnd, currency: "VND" };
      w.gtag?.("event", name, { ...value, ...(item ? { items: [{ item_id: item }] } : {}) });
      w.fbq?.("track", META_EVENT[name], { ...value, ...(item ? { content_ids: [item], content_type: "product" } : {}) });
    }, 0);
    return () => clearTimeout(id);
  }, [name, valueVnd, item, once]);
  return null;
}
