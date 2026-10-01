"use client";

import { appConfig } from "@/config/app";
import { getMarketingContent } from "@/content";

/** Last-resort boundary (errors in the root layout itself): no layout, no CSS — plain, readable HTML. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const c = getMarketingContent(appConfig.defaultLocale).error;
  return (
    <html lang={appConfig.defaultLocale}>
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem", color: "#18181b" }}>
        <h1 style={{ fontSize: "1.75rem" }}>{c.title}</h1>
        <p>{c.text}</p>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>ref: {error.digest}</p>}
        <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}>
          {c.retry}
        </button>
      </body>
    </html>
  );
}
