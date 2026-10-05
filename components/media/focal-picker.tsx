"use client";

import { useState } from "react";

/** Click the main subject of the image: posts focalX / focalY (0–1) with the surrounding form. */
export function FocalPicker({ src, alt, initial, label }: { src: string; alt: string; initial: { x: number; y: number }; label: string }) {
  const [point, setPoint] = useState(initial);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-label={label}
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-border"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPoint({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000 });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- media CDN image, already sized */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        <span
          aria-hidden="true"
          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70 shadow"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        />
      </button>
      <input type="hidden" name="focalX" value={point.x} />
      <input type="hidden" name="focalY" value={point.y} />
    </div>
  );
}
