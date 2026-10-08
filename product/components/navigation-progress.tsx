"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type State = "idle" | "loading" | "done";

/** Starts on a click that leaves the current page (same site, plain left click, not a new tab or a download). */
function leavesPage(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest("a");
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  return url.origin === window.location.origin && (url.pathname !== window.location.pathname || url.search !== window.location.search);
}

/**
 * Thin bar in the theme's primary color at the top while a page is on its way. Only shows when the change takes
 * longer than 150 ms (prefetched pages swap before that); finishes when the URL changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<State>("idle");

  // The new page is in (the URL changed): finish. Adjusted while rendering, React's pattern for state that follows a value.
  const url = `${pathname}?${search.toString()}`;
  const [shownUrl, setShownUrl] = useState(url);
  if (shownUrl !== url) {
    setShownUrl(url);
    if (state === "loading") setState("done");
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => leavesPage(e) && setState("loading");
    const onSubmit = (e: SubmitEvent) => !e.defaultPrevented && (e.target as HTMLFormElement).method === "get" && setState("loading");
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  useEffect(() => {
    if (state === "idle") return;
    // "done" fades out; a navigation that never lands (offline, cancelled) gives up after 10 s.
    const t = setTimeout(() => setState("idle"), state === "done" ? 400 : 10_000);
    return () => clearTimeout(t);
  }, [state]);

  const style =
    state === "loading"
      ? "w-4/5 opacity-100 transition-[width,opacity] duration-[8s,0s] delay-150 ease-out"
      : state === "done"
        ? "w-full opacity-0 transition-[width,opacity] duration-200"
        : "w-0 opacity-0";
  return <div aria-hidden="true" className={`pointer-events-none fixed top-0 left-0 z-[60] h-0.5 bg-primary ${style}`} />;
}
