import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Adjust sampling rate for production
  tracesSampleRate: 0.1,

  // Session replay configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Set environment
  environment: process.env.NODE_ENV,

  // Filter out known non-critical errors
  beforeSend(event) {
    // Filter out errors you don't want to track
    if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) {
      return null;
    }
    return event;
  },
});
