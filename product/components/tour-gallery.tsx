"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import type { Locale } from "@/config/app";
import { getProductContent } from "../content";

/**
 * Tour photos: one large and up to four small (1+4 grid), opening a full-screen viewer (native <dialog>:
 * Escape closes, arrow keys move, focus returns to the photo that opened it).
 */
export function TourGallery({ images, title, locale }: { images: string[]; title: string; locale: Locale }) {
  // Text with functions (counts) is read here: functions cannot cross from server to client props.
  const t = getProductContent(locale).tours;
  const labels = { gallery: t.gallery, ...t.galleryLabels };
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const n = images.length;
  // Layout by photo count, so no grid cell stays empty: 1 | 2 side by side | 1+2 | 1+4.
  const shown = images.slice(0, n >= 5 ? 5 : n >= 3 ? 3 : n);
  const grid = shown.length === 5 ? "sm:grid-cols-4 sm:grid-rows-2" : shown.length === 3 ? "sm:grid-cols-3 sm:grid-rows-2" : shown.length === 2 ? "sm:grid-cols-2" : "";
  const big = shown.length >= 3 ? "sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:min-h-[26rem]" : "sm:aspect-[16/9]";

  const open = (i: number, from: HTMLElement) => {
    opener.current = from;
    setIndex(i);
    dialog.current?.showModal();
  };
  const move = (by: number) => setIndex((i) => (i === null ? i : (i + by + n) % n));

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => {
      setIndex(null);
      opener.current?.focus();
    };
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  return (
    <section aria-label={labels.gallery} data-testid="gallery" className="relative">
      <div className={cn("grid gap-2 overflow-hidden", grid)}>
        {shown.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={(e) => open(i, e.currentTarget)}
            className={cn("relative block overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2", i === 0 ? cn("aspect-[4/3]", big) : cn("hidden aspect-[4/3] sm:block", shown.length === 2 && "sm:aspect-[16/9]"))}
            aria-label={labels.photo(i + 1, n)}
          >
            <Image src={src} alt={i === 0 ? title : ""} fill priority={i === 0} sizes={i === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"} className="object-cover transition duration-500 hover:scale-105" />
          </button>
        ))}
      </div>
      {n > 1 && (
        <button
          type="button"
          onClick={(e) => open(0, e.currentTarget)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow"
        >
          <Images className="size-4" aria-hidden="true" />
          {labels.viewAll(n)}
        </button>
      )}

      <dialog
        ref={dialog}
        aria-label={labels.gallery}
        className="m-0 h-full max-h-none w-full max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          if (e.key === "ArrowLeft") move(-1);
        }}
      >
        {index !== null && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-4 text-sm">
              <span aria-live="polite">{labels.photo(index + 1, n)}</span>
              <button type="button" onClick={() => dialog.current?.close()} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">
                <X className="size-4" aria-hidden="true" />
                {labels.close}
              </button>
            </div>
            <div className="relative flex-1">
              <Image src={images[index]!} alt={`${title} (${index + 1}/${n})`} fill sizes="100vw" className="object-contain" />
            </div>
            {n > 1 && (
              <div className="flex justify-center gap-3 p-4">
                <button type="button" onClick={() => move(-1)} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  {labels.previous}
                </button>
                <button type="button" onClick={() => move(1)} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">
                  {labels.next}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
