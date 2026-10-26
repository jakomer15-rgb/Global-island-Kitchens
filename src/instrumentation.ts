import type { Instrumentation } from "next";

/**
 * Server errors as one JSON line each on stdout, which the host's log search can filter on
 * (`"level":"error"`). Only the route, method, message and a short stack are logged: no query string,
 * headers, cookies or request body. A Sentry DSN can be added later without changing this (docs/HANDOVER.md).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      route: context.routePath,
      kind: context.routeType,
      method: request.method,
      path: request.path.split("?")[0],
      message: String(err.message).slice(0, 300),
      digest: err.digest,
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
    }),
  );
};
