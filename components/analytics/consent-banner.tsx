"use client";

import { useState, useSyncExternalStore } from "react";
import { CONSENT_COOKIE, CONSENT_MAX_AGE } from "./consent";

const noop = () => () => {};
const hasChoice = () => document.cookie.split(/;\s*/).some((c) => c.startsWith(`${CONSENT_COOKIE}=`));

export interface ConsentBannerProps {
  text: string;
  accept: string;
  decline: string;
  privacyLabel: string;
  privacyHref: string;
}

/** Asks once; the choice lives in a first-party cookie. Without "accept", page views stay anonymous counts. */
export function ConsentBanner({ text, accept, decline, privacyLabel, privacyHref }: ConsentBannerProps) {
  // Server render: hidden (no cookie access); client: shown until a choice is stored.
  const decided = useSyncExternalStore(noop, hasChoice, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (decided || dismissed) return null;

  const choose = (value: "granted" | "denied") => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    setDismissed(true);
  };

  return (
    <div role="dialog" aria-label={privacyLabel} className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg border border-border bg-background p-4 text-sm shadow-lg">
      <p>
        {text}{" "}
        <a href={privacyHref} className="underline">
          {privacyLabel}
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("granted")} className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground">
          {accept}
        </button>
        <button type="button" onClick={() => choose("denied")} className="h-9 rounded-md border border-border px-4">
          {decline}
        </button>
      </div>
    </div>
  );
}
