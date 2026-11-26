// Les seules fonctions de Sentry utilisées dans le navigateur, chargées à
// la demande par src/instrumentation-client.ts.
//
// Ne pas remplacer par import("@sentry/nextjs") : un import() du paquet
// entier oblige le compilateur à tout embarquer (enregistreur de sessions,
// formulaire de retour, profilage…), soit 192 Ko compressés au lieu de
// ~60 Ko (mesuré en ligne le 26/11/2026). Passer par ce fichier lui permet
// de ne garder que ce qui est listé ici.
export { init, captureException, captureRouterTransitionStart } from "@sentry/nextjs";
