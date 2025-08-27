import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    release: process.env.RELEASE_SHA || undefined,
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
    ],
    tracesSampleRate: 0.2,   // tune later
    profilesSampleRate: 0.0, // enable if you want profiling
  } as any);
}
export { Sentry };
