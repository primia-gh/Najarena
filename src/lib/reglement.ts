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

export const CARTE_1V1 = "Abîme hurlant";
export const MODE_1V1 = "Aveugle (blind pick)";

/** Étapes d'un match, dans l'ordre, pour la salle de match. */
export function etapesMatch(adversaireRiotId: string | null, jeCreeLaPartie: boolean, bestOf: number): string[] {
  const ami = adversaireRiotId ? `Ajoute ${adversaireRiotId} en ami dans le client League of Legends.` : "Ajoute ton adversaire en ami (Riot ID sur son profil).";
  const creation = jeCreeLaPartie
    ? `Crée une partie personnalisée : ${CARTE_1V1}, ${MODE_1V1}, un joueur par équipe, puis invite ton adversaire.`
    : `Ton adversaire crée la partie personnalisée (${CARTE_1V1}, ${MODE_1V1}) et t'invite : accepte son invitation.`;
  const manches =
    bestOf > 1
      ? `Jouez les manches à la suite, une partie par manche : la série s'arrête dès qu'un joueur a gagné ${Math.floor(bestOf / 2) + 1} manches.`
      : null;
  return [
    ami,
    creation,
    "Jouez jusqu'à la destruction du Nexus (ou l'abandon du perdant) : une partie quittée sans vainqueur ne peut pas être lue.",
    ...(manches ? [manches] : []),
    "Rien à déclarer : le résultat est lu automatiquement dans l'historique Riot, quelques minutes après la fin de la partie.",
  ];
}

/** Règles courtes, pour le bloc « L'essentiel du règlement ». */
export const REGLE_PARTIE_1V1 = `Partie personnalisée ${CARTE_1V1} en 1v1, menée jusqu'à la destruction du Nexus ou l'abandon du perdant ; moins de 5 minutes = remake, la partie n'est pas retenue.`;
