import type { Instrumentation } from "next";

/**
 * Server-side errors from pages, route handlers and server actions, as one structured log line each.
 * The digest matches the "ref" shown on the error page. Plug an error tracker (e.g. Sentry) in here.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { createLogger } = await import("@/core/logger");
  const err = error as Error & { digest?: string };
  createLogger().error("request.error", {
    digest: err.digest,
    error: { name: err.name, message: err.message },
    method: request.method,
    // Path without query string: queries can carry tokens or emails.
    path: request.path.split("?")[0],
    requestId: request.headers["x-request-id"],
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
