"use client";

import { useState } from "react";

/** Copies a value (account number, transfer note) and says so for a moment. */
export function CopyButton({ value, label, copiedLabel, name }: { value: string; label: string; copiedLabel: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded border border-border px-2 py-0.5 text-xs font-medium hover:bg-muted"
      aria-label={`${label}: ${name}`}
      onClick={() =>
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
          () => {},
        )
      }
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
