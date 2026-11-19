// Version des CGU en vigueur (28/09/2026, audit M10) : enregistrée avec la
// date d'acceptation de chaque compte (profiles.consentement_version). À
// changer à chaque modification des CGU. 02/10/2026 : tournois classés,
// forfait automatique, conditions de victoire du 1v1, défis entre joueurs
// (version jamais mise en ligne). 03/10/2026 : tournois 5v5. 04/10/2026 :
// écoles et tournois réservés aux membres d'une communauté. Allumer les
// cash prizes (CASH_PRIZES_ACTIFS) ajoute un paragraphe aux CGU : changer
// alors cette version. 19/11/2026 : suppression du compte en libre-service,
// renvoi aux conditions générales de vente des offres payantes.
export const VERSION_CGU = "2026-11-19";
export const DATE_CGU_LISIBLE = "19 novembre 2026";

// Connexion via Discord : le consentement coché avant de partir chez
// Discord est gardé le temps de l'aller-retour (10 minutes au plus), puis
// enregistré au retour (src/app/auth/callback/route.ts).
export const COOKIE_CONSENTEMENT = "najarena_consentement";
