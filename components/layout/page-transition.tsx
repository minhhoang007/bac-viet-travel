import Link from "next/link";
import { ViewTransition, type ComponentProps, type ReactNode } from "react";

/**
 * Transition type of a page change. Only navigations tagged with it animate: a form action or a filter update inside
 * the page re-renders without the page animation.
 */
export const PAGE_TRANSITION = "page-change";

/** Wraps the page area (layout <main>): the old page fades out, the new one rises in (classes in app/globals.css). */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition update={{ [PAGE_TRANSITION]: "page", default: "none" }} default="none">
      {children}
    </ViewTransition>
  );
}

/** next/link that changes the page with the page animation (PageTransition). */
export function PageLink({ transitionTypes, ...props }: ComponentProps<typeof Link>) {
  return <Link transitionTypes={transitionTypes ?? [PAGE_TRANSITION]} {...props} />;
}
