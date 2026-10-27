import type { LogEntry } from "@/core/logger";

/**
 * Sends error log entries to Sentry through its envelope endpoint (no SDK). Entries are already redacted by the
 * logger, so nothing the logs would hide leaves the server. Fire and forget, 5 s timeout: a slow or failing Sentry
 * never delays or breaks the request that logged.
 */
export function sentryReporter(options: {
  dsn: string;
  environment?: string;
  release?: string;
  fetch?: typeof fetch;
}): (entry: LogEntry) => Promise<void> {
  const doFetch = options.fetch ?? fetch;
  const dsn = new URL(options.dsn);
  const projectId = dsn.pathname.split("/").filter(Boolean).pop();
  const endpoint = `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/`;
  const auth = `Sentry sentry_version=7, sentry_client=minh-starter/1, sentry_key=${dsn.username}`;

  return async (entry) => {
    const { time, level, msg, ...extra } = entry;
    const eventId = crypto.randomUUID().replaceAll("-", "");
    const event = {
      event_id: eventId,
      timestamp: time,
      platform: "node",
      level,
      logger: "app",
      message: { formatted: msg },
      // Grouped by the log message (e.g. "job.dead"), with the error text when there is one.
      fingerprint: ["{{ default }}", msg],
      environment: options.environment,
      release: options.release,
      extra,
    };
    const body = [JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
    try {
      await doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": auth },
        body,
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // the error itself is already in the logs
    }
  };
}
