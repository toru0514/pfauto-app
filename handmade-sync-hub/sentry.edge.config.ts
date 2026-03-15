import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Adjust sampling rate for production
  tracesSampleRate: 0.1,

  // Set environment
  environment: process.env.NODE_ENV,
});
