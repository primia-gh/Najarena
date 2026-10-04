// Page où revenir une fois le compte Riot vérifié (28/09/2026, « Invite ton
// rival », audit N18) : l'ami invité lie son Riot ID puis retrouve le défi.
// La vérification se fait en deux étapes (liaison, puis contrôle de
// l'icône) : la destination est gardée dans un cookie court entre les deux.
// Chemin du site seulement (src/lib/redirection.ts).

export const COOKIE_SUITE = "najarena_suite";
export const DUREE_COOKIE_SUITE_SECONDES = 60 * 60;
