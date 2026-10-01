"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { getMarketingContent } from "@/content";

/**
 * Error boundary for pages under a locale. The server already logged the error (instrumentation.ts);
 * `digest` is the reference shown to users so support can find the log line.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = (appConfig.locales as readonly string[]).includes(params.locale ?? "") ? (params.locale as Locale) : appConfig.defaultLocale;
  const c = getMarketingContent(locale).error;

  useEffect(() => {
    // Client-side errors never reach the server log: report the digest only (no message, it may hold personal data).
    console.error("page.error", { digest: error.digest });
  }, [error.digest]);

  return (
    <Container className="py-24 text-center" role="alert">
      <h1 className="text-3xl font-bold">{c.title}</h1>
      <p className="mt-3 text-muted-foreground">{c.text}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>{c.retry}</Button>
        <Button asChild variant="outline">
          <a href={localePath(locale)}>{c.back}</a>
        </Button>
      </div>
    </Container>
  );
}
