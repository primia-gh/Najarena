// Pendant du suivi d'erreurs côté navigateur (voir src/instrumentation.ts) —
// NEXT_PUBLIC_ car lu côté client. Repli gracieux identique : sans la
// variable, Sentry n'est jamais chargé.
//
// Chargé APRÈS l'affichage de la page (audit web du 26/11/2026, I3) :
// Sentry pesait 60 Ko compressés sur les 357 Ko de JavaScript de chaque
// page, téléchargés et exécutés avant que la page ne réponde. Il arrive
// désormais dans un fichier à part, une fois la page chargée et le
// navigateur libre. Les erreurs survenues avant son arrivée ne sont pas
// perdues : elles sont gardées puis transmises dès qu'il est prêt.
import type * as SentryModule from "@/lib/sentry-navigateur";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sentry: typeof SentryModule | null = null;
// Erreurs et promesses rejetées avant le chargement de Sentry (limité, pour
// ne pas grossir sans fin si Sentry ne se charge jamais).
const erreursEnAttente: unknown[] = [];
const MAX_EN_ATTENTE = 20;

function garderErreur(evenement: ErrorEvent) {
  if (erreursEnAttente.length < MAX_EN_ATTENTE) erreursEnAttente.push(evenement.error ?? evenement.message);
}

function garderRejet(evenement: PromiseRejectionEvent) {
  if (erreursEnAttente.length < MAX_EN_ATTENTE) erreursEnAttente.push(evenement.reason);
}

function chargerSentry() {
  void import("@/lib/sentry-navigateur").then((module) => {
    module.init({
      dsn: DSN,
      tracesSampleRate: 0.1,
    });
    window.removeEventListener("error", garderErreur);
    window.removeEventListener("unhandledrejection", garderRejet);
    for (const erreur of erreursEnAttente.splice(0)) module.captureException(erreur);
    sentry = module;
  }).catch(() => {
    // Fichier bloqué (bloqueur de publicités, réseau coupé) : le site
    // fonctionne sans suivi d'erreurs, on cesse simplement de les garder.
    window.removeEventListener("error", garderErreur);
    window.removeEventListener("unhandledrejection", garderRejet);
    erreursEnAttente.length = 0;
  });
}

function planifier() {
  // Navigateur libre (requestIdleCallback), au plus tard 3 s après le
  // chargement ; Safari ne connaît pas requestIdleCallback.
  if ("requestIdleCallback" in window) window.requestIdleCallback(chargerSentry, { timeout: 3000 });
  else setTimeout(chargerSentry, 1000);
}

if (DSN && typeof window !== "undefined") {
  window.addEventListener("error", garderErreur);
  window.addEventListener("unhandledrejection", garderRejet);
  if (document.readyState === "complete") planifier();
  else window.addEventListener("load", planifier, { once: true });
}

// Suivi des changements de page : transmis à Sentry une fois chargé (les
// navigations d'avant son arrivée ne sont simplement pas suivies).
export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  sentry?.captureRouterTransitionStart(url, navigationType);
}
