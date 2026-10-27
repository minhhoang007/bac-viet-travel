import type { Instrumentation } from "next";

/**
 * Server-side errors from pages, route handlers and server actions, as one structured log line each.
 * The digest matches the "ref" shown on the error page. With SENTRY_DSN the line also goes to Sentry (appLogger).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { createLogger } = await import("@/core/logger");
  let logger;
  try {
    const { appLogger } = await import("@/bootstrap/container");
    const { getEnv } = await import("@/bootstrap/env");
    logger = appLogger(getEnv());
  } catch {
    logger = createLogger(); // invalid configuration: still log the error
  }
  const err = error as Error & { digest?: string };
  logger.error("request.error", {
    digest: err.digest,
    error: err,
    method: request.method,
    // Path without query string: queries can carry tokens or emails.
    path: request.path.split("?")[0],
    requestId: request.headers["x-request-id"],
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
