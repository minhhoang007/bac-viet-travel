"use client";

// Counts clicks from a blog post to a tour as GA4 "select_item" (item list "blog"), so reports show which posts lead
// to bookings. Sent only when the ad tags run, i.e. after cookie consent (product/analytics/marketing-tags.tsx).
import type { ReactNode } from "react";

type TagWindow = Window & { gtag?: (...args: unknown[]) => void };

export function BlogTourClicks({ post, children }: { post: string; children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="/tours/"]');
        const slug = link?.pathname.split("/tours/")[1]?.split("/")[0];
        if (slug) (window as TagWindow).gtag?.("event", "select_item", { item_list_name: "blog", item_list_id: post, items: [{ item_id: slug }] });
      }}
    >
      {children}
    </div>
  );
}
