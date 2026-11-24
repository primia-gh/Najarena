// Couleurs par palier (CLAUDE.md §4, seuils fixes) — cohérent avec le
// dégradé laiton/sceau du reste du site plutôt que des teintes arbitraires
// par palier. Partagé entre l'accueil (paliers) et les pages preuve
// (crest de palier à côté d'un pseudo).
export const COULEUR_PALIER: Record<string, string> = {
  // Noms des paliers changés le 24/11/2026 (Bronze → Mue, Argent → Écaille,
  // Or → Crochet, Platine → Venin, Diamant → Cobra, Champion → Basilic) :
  // ne pas reprendre les rangs de la file classée de Riot (règles des
  // développeurs Riot). Seuils et couleurs inchangés.
  mue: "#8a6a52",
  écaille: "#9aa4ae",
  // Valeurs figées (refonte Venin, 24/09/2026) : les paliers sont la seule
  // exception au « tout vert » (CLAUDE.md §7) et ne doivent pas dépendre
  // des anciens jetons, supprimés à la fin de la refonte.
  crochet: "#d2a257",
  venin: "#4fb8ae",
  cobra: "#6fa8e8",
  basilic: "#c4485c",
};
