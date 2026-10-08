"use client";

import { useState, type ReactNode } from "react";

/**
 * Wrapper of a CSS hover/focus menu (Tailwind `group`). Pages change in place, so after a click the pointer is still
 * over the menu: it sets data-closed (style the panel with group-data-[closed]:hidden) until the pointer leaves or
 * the keyboard comes back.
 */
export function HoverMenu({ className, children }: { className?: string; children: ReactNode }) {
  const [closed, setClosed] = useState(false);
  return (
    <div
      className={className}
      data-closed={closed || undefined}
      onClick={(e) => {
        if (!(e.target as Element).closest("a")) return;
        setClosed(true);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
      onMouseLeave={() => setClosed(false)}
      onKeyDown={() => setClosed(false)}
    >
      {children}
    </div>
  );
}
