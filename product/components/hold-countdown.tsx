"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const format = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** mm:ss until the hold expires; refreshes the page at zero so the server shows the expired state. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const end = new Date(expiresAt).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        router.refresh();
      }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [end, router]);

  return (
    <strong className="font-mono text-lg tabular-nums" data-testid="countdown" role="timer" aria-live="off">
      {left === null ? "--:--" : format(left)}
    </strong>
  );
}
