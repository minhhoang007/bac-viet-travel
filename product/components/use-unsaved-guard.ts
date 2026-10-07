"use client";

import { useEffect } from "react";

/**
 * Asks before leaving a form with unsaved changes: closing the tab or reloading (beforeunload) and clicking any link
 * on the page (menu, "back"). Saving the form itself is not asked about.
 */
export function useUnsavedGuard(dirty: boolean, question: string) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || event.defaultPrevented || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(question)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, question]);
}
