// Couleurs par palier (CLAUDE.md §4, seuils fixes) — cohérent avec le
// dégradé laiton/sceau du reste du site plutôt que des teintes arbitraires
// par palier. Partagé entre l'accueil (paliers) et les pages preuve
// (crest de palier à côté d'un pseudo).
export const COULEUR_PALIER: Record<string, string> = {
  bronze: "#8a6a52",
  argent: "#9aa4ae",
  or: "var(--color-laiton)",
  platine: "#4fb8ae",
  diamant: "#6fa8e8",
  champion: "var(--color-sceau)",
};
