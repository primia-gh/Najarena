// Suivi d'erreurs serveur (Sentry) — même motif de repli gracieux que
// Resend/Riot/service_role : sans SENTRY_DSN, Sentry.init() n'est jamais
// appelé et captureRequestError() ne fait rien (comportement natif du SDK
// sans client configuré). Voir .env.local pour l'activer.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
