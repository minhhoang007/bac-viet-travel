"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Phones: the filter fields stay folded behind one button so the tours come first. From lg the fields always show
 * (display: contents keeps them in the form's grid).
 */
export function FilterToggle({ label, active, children }: { label: string; active: number; children: ReactNode }) {
  const [open, setOpen] = useState(active > 0);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="col-span-2 flex h-11 items-center gap-2 font-semibold lg:hidden"
        data-testid="filter-toggle"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {label}
        {active > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground tabular-nums">{active}</span>}
        <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div className={open ? "contents" : "hidden lg:contents"}>{children}</div>
    </>
  );
}
