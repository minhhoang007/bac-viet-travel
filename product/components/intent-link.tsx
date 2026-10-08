"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

/**
 * next/link that prefetches only once the visitor shows intent (pointer over it, touch, keyboard focus) instead of as
 * soon as it scrolls into view. For links many pages show but few visitors follow (footer) and links to dynamic
 * pages (booking: every prefetch would run the server and the database).
 */
export function IntentLink({ onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}

/** IntentLink with the starter ButtonLink's look (ButtonLink prefetches as soon as it is in view). */
export function IntentButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "outline" }) {
  return <IntentLink className={cn(buttonVariants({ variant: variant === "primary" ? "default" : "outline" }), "h-11 px-5", className)} {...props} />;
}
