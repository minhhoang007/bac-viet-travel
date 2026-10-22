"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = { render: (container: HTMLElement, options: { sitekey: string; language?: string }) => string; reset: (widgetId: string) => void };
const api = () => (window as { turnstile?: TurnstileApi }).turnstile;

/**
 * Cloudflare Turnstile bot check inside a form (it adds a hidden "cf-turnstile-response" field). Rendered explicitly so
 * a page with two forms (login: email link and password) resets the right widget. `answer`: the form's last server
 * answer; a token works once, so each answer asks for a fresh one.
 */
export function Turnstile({ siteKey, locale, answer, className }: { siteKey?: string; locale: string; answer: unknown; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const render = useCallback(() => {
    const turnstile = api();
    if (!siteKey || !turnstile || !container.current || widget.current) return;
    widget.current = turnstile.render(container.current, { sitekey: siteKey, language: locale });
  }, [siteKey, locale]);

  // The script may already be there (another page loaded it): render now; otherwise onReady does.
  useEffect(render, [render]);
  useEffect(() => {
    if (answer && widget.current) api()?.reset(widget.current);
  }, [answer]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onReady={render} />
      <div ref={container} className={className} />
    </>
  );
}
