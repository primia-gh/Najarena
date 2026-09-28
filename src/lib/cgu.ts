// Version des CGU en vigueur (28/09/2026, audit M10) : enregistrée avec la
// date d'acceptation de chaque compte (profiles.consentement_version). À
// changer à chaque modification des CGU.
export const VERSION_CGU = "2026-09-28";
export const DATE_CGU_LISIBLE = "28 septembre 2026";

// Connexion via Discord : le consentement coché avant de partir chez
// Discord est gardé le temps de l'aller-retour (10 minutes au plus), puis
// enregistré au retour (src/app/auth/callback/route.ts).
export const COOKIE_CONSENTEMENT = "najarena_consentement";
