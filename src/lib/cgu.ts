// Version des CGU en vigueur (28/09/2026, audit M10) : enregistrée avec la
// date d'acceptation de chaque compte (profiles.consentement_version). À
// changer à chaque modification des CGU. 02/10/2026 : tournois classés,
// forfait automatique, conditions de victoire du 1v1, défis entre joueurs
// (version jamais mise en ligne). 03/10/2026 : tournois 5v5. 04/10/2026 :
// écoles et tournois réservés aux membres d'une communauté.
export const VERSION_CGU = "2026-10-04";
export const DATE_CGU_LISIBLE = "4 octobre 2026";

// Connexion via Discord : le consentement coché avant de partir chez
// Discord est gardé le temps de l'aller-retour (10 minutes au plus), puis
// enregistré au retour (src/app/auth/callback/route.ts).
export const COOKIE_CONSENTEMENT = "najarena_consentement";
