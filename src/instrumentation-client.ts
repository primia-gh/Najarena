// Pendant du suivi d'erreurs côté navigateur (voir src/instrumentation.ts) —
// NEXT_PUBLIC_ car lu côté client. Repli gracieux identique : sans la
// variable, Sentry.init() n'est jamais appelé.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
