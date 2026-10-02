// Règlement d'un match 1v1 (28/09/2026, audit E9) : jusqu'ici, rien ne
// disait quelle carte jouer, comment on gagne, qui crée la partie ni
// comment trouver l'adversaire — alors que Riot exige des conditions de
// victoire claires et que le moteur ne lit que le vainqueur « officiel »
// d'une partie (Nexus détruit ou abandon).
//
// Règles cohérentes avec ce que le moteur sait lire (src/lib/serie.ts) :
// partie personnalisée, deux joueurs, plus de 5 minutes, menée jusqu'au
// bout. Carte et mode sont un choix produit : les changer ici suffit, tous
// les écrans lisent ce fichier.
//
// Depuis le 28/09/2026 (audit N5), un tournoi peut aussi se jouer au 1v1
// classique — premier sang, première tour ou 100 sbires — lu dans la
// chronologie Riot de la partie (src/lib/conditions-1v1.ts).

import { DELAI_FORFAIT_MINUTES } from "./forfait";
import { SBIRES_VICTOIRE, type ConditionVictoire } from "./conditions-1v1";

export const CARTE_1V1 = "Abîme hurlant";
export const MODE_1V1 = "Aveugle (blind pick)";

/** Forfait automatique (audit N4) : même délai que src/lib/forfait.ts. */
export const REGLE_FORFAIT = `Déclare-toi prêt dans la salle de match : dès que l'un des deux joueurs l'est, l'autre a ${DELAI_FORFAIT_MINUTES} minutes pour faire de même, sinon il perd par forfait (aucun point pour personne). Jamais de forfait pour un joueur déjà en partie.`;

/** Étapes d'un match, dans l'ordre, pour la salle de match. */
export function etapesMatch(
  adversaireRiotId: string | null,
  jeCreeLaPartie: boolean,
  bestOf: number,
  condition: ConditionVictoire = "nexus",
): string[] {
  const ami = adversaireRiotId ? `Ajoute ${adversaireRiotId} en ami dans le client League of Legends.` : "Ajoute ton adversaire en ami (Riot ID sur son profil).";
  const creation = jeCreeLaPartie
    ? `Crée une partie personnalisée : ${CARTE_1V1}, ${MODE_1V1}, un joueur par équipe, puis invite ton adversaire.`
    : `Ton adversaire crée la partie personnalisée (${CARTE_1V1}, ${MODE_1V1}) et t'invite : accepte son invitation.`;
  const victoire =
    condition === "classique"
      ? `Le premier qui obtient le premier sang, détruit la première tour ou atteint ${SBIRES_VICTOIRE} sbires gagne. Ensuite, le perdant quitte la partie et le vainqueur la termine (Nexus) : une partie qui ne se termine pas n'apparaît pas dans l'historique Riot.`
      : "Jouez jusqu'à la destruction du Nexus (ou l'abandon du perdant) : une partie quittée sans vainqueur ne peut pas être lue.";
  const manches =
    bestOf > 1
      ? `Jouez les manches à la suite, une partie par manche : la série s'arrête dès qu'un joueur a gagné ${Math.floor(bestOf / 2) + 1} manches.`
      : null;
  return [
    `Clique « Je suis prêt » ci-dessous dès que tu es devant ton jeu : ton adversaire a alors ${DELAI_FORFAIT_MINUTES} minutes pour faire de même (et toi aussi, s'il l'est avant toi).`,
    ami,
    creation,
    victoire,
    ...(manches ? [manches] : []),
    "Rien à déclarer : le résultat est lu automatiquement dans l'historique Riot, quelques minutes après la fin de la partie.",
  ];
}

/** Règles courtes, pour le bloc « L'essentiel du règlement ». */
export function reglePartie1v1(condition: ConditionVictoire = "nexus"): string {
  return condition === "classique"
    ? `Partie personnalisée ${CARTE_1V1} en 1v1, règle classique : le premier qui obtient le premier sang, détruit la première tour ou atteint ${SBIRES_VICTOIRE} sbires gagne, lu dans la chronologie Riot de la partie. Si l'ordre de deux conditions ne peut pas être établi, l'organisateur tranche.`
    : `Partie personnalisée ${CARTE_1V1} en 1v1, menée jusqu'à la destruction du Nexus ou l'abandon du perdant ; moins de 5 minutes = remake, la partie n'est pas retenue.`;
}

export const REGLE_PARTIE_1V1 = reglePartie1v1("nexus");
