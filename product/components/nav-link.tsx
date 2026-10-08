"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { appConfig } from "@/config/app";
import { IntentLink } from "./intent-link";

/** Path without its locale prefix: the router may report the rewritten "/vi/tours" for the visible "/tours". */
function unprefixed(path: string): string {
  const [, first = ""] = path.split("/");
  return (appConfig.locales as readonly string[]).includes(first) ? path.slice(first.length + 1) || "/" : path;
}

/** Header link (in-place navigation) that marks the current section: aria-current="page", styled with aria-[current=page]:. */
export function NavLink({ href, ...props }: ComponentProps<typeof IntentLink> & { href: string }) {
  const pathname = unprefixed(usePathname());
  const target = unprefixed(href);
  // Anchors ("/#contact") never count as the current section. Not meant for the home link (it would match everything).
  const current = !href.includes("#") && (pathname === target || pathname.startsWith(`${target}/`));
  return <IntentLink href={href} aria-current={current ? "page" : undefined} {...props} />;
}
